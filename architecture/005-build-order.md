# Sub of Fame - Build Order

The canonical implementation sequence for the MVP. Product and UX intent live in `001-overview.md`; contracts, types, and procedure flows live in `002-api.md`; image handling in `003-image-handling.md`; gameplay/timer UX in `004-puzzle-time-clock.md`.

This document is the build roadmap. It does not redefine any contract—each step points to the doc section it implements. When a contract changes, update the owning doc first, then reconcile the affected step here.

---

## Build Philosophy

- **Backend-first, dependency-layered.** Every step's prerequisites are already built by an earlier step. No step depends on something later in the list.
- **Contracts before logic.** Shared types, the launch-context invariant, and the Redis key topology are fully settled before any procedural code is written.
- **Engine before UI.** All four tRPC procedures are functional and testable before the React webview is wired to them.
- **One unit per step.** Each step maps to a single contract section so the `task-researcher` and `task-planner` agents can cite an authoritative source per step instead of fusing concerns.

### Dependency Map (high level)

```
Phase A (foundation)      1 ─┬─> 2 ─┐
                             └─> 3 ─┤
Phase B (backend engine)         4 ─┼─> 6
                                 5 ─┤
                          (4,5) ───┼─> 7 ─> 8
                          (2,3) ───┴─> 9   (9 also reads 4/6 metadata, 8 leaderboard)
Phase C (frontend)        (1,7) ──> 10 ─> 11
                          (9,10) ─────────> 12
```

---

## Phase A — Foundation (contracts & state)

### 1. Universal Shared Types & Contracts

- **Target files:** `src/shared/api.ts`, `src/shared/subreddits.ts`
- **Goal:** Establish an airtight data contract across client and server before a single line of procedural logic is written.
- **Scope:**
  - Define all shared request/response types (`InitResponse`, session, `PuzzleNextResponse`, `PuzzleSubmitResponse`, error code unions), stats/metric types, and dashboard card shapes.
  - Define `CURATED_SUBREDDITS` and the subreddit display metadata shapes.
  - Add the optional `imageUrl` field to `PuzzleSnapshot` and propagate it through the post shape exposed on the `puzzle.next` `ready` payload.
- **Depends on:** nothing.
- **References:** `002-api.md` (Shared API Types, Shared Catalog), `003-image-handling.md` §2.
- **Done when:** all shared types compile and are imported by no procedural logic yet.

### 2. Launch Context Resolver (shared backend invariant)

- **Target files:** server launch-context helper (e.g. `src/server/launchContext.ts`)
- **Goal:** Build the host-locking security invariant that every gameplay procedure runs first, before it is duplicated implicitly inside each handler.
- **Scope:**
  - Normalize `context.subredditName` once per request (strip `r/`, lowercase, trim).
  - Derive `LaunchContext` (`hub` only when host is `suboffame`, else `community`).
  - Provide the rule used by procedures to accept a client-supplied subreddit only when it matches the host after normalization.
- **Depends on:** 1.
- **References:** `002-api.md` "Launch Context & Subreddit Resolution".
- **Done when:** hub vs community resolution and normalization are unit-tested; a community post provably cannot launch or submit another subreddit's gameplay.

### 3. Redis Key Topology & Client Wrappers

- **Target files:** Redis client wrapper / database initialization helpers
- **Goal:** Pre-configure all state hashes, sets, caches, and locks with typed accessors and documented TTLs before any procedure reads or writes them.
- **Scope:** progress hash, profile stats hash, leaderboard ZSET, subreddit metadata cache, ladder page cache + durable cursor chain, puzzle snapshot, puzzle attempt, submit lock.
- **Depends on:** 1.
- **References:** `002-api.md` "Redis Schema".
- **Done when:** each key has a typed read/write helper with its TTL encoded; no gameplay logic lives here yet.

---

## Phase B — Backend Engine

### 4. Cursor-Linked Live Ladder Cache Pipeline (+ image normalization + work budget)

- **Target files:** Reddit fetch/cache service
- **Goal:** Turn a `rankIndex` into a cached `LadderPostSummary` safely and within the serverless budget.
- **Scope:**
  - Cursor-chain page resolution: fetch a target page directly when its start cursor is known, otherwise warm forward from `deepestKnownPage` (never from page 1); persist page content (7d) and the cursor chain (30d).
  - The free `LadderPostSummary` fast-filter (NSFW, spoiler, title/body, comment-count hint).
  - Image URL normalization during the fetch, stored on the summary/snapshot per `003`.
  - The shared `NextWorkBudget` definition and the rule that every `getTopPosts`/`getComments` decrements `redditCallsRemaining` and respects `softDeadlineAt`.
- **Depends on:** 1, 3.
- **References:** `002-api.md` "Ladder Cache" + "Serverless Work Budget"; `003-image-handling.md` §1.
- **Done when:** an arbitrary `rankIndex` resolves to a page via cache or cursor chain; budget guards stop work before the serverless limit; images are normalized into summaries.

### 5. Comment Validation & Snapshot Freezing

- **Target files:** comment extraction/validation service
- **Goal:** Decide post playability and freeze the true answer order—the heart of the puzzle.
- **Scope:**
  - Strict `depth: 1` top-level extraction, validity rules (deleted/removed, AutoModerator, stickied/distinguished, too-short, missing/hidden score).
  - Sort valid roots by score, select the first three only if all scores are distinct; reject on ties.
  - Freeze the true order into `PuzzleSnapshot` (including `imageUrl`); the shuffled presentation order is derived when the attempt is minted.
- **Depends on:** 1, 3.
- **References:** `002-api.md` "Comment Validation Contract" + "Puzzle Snapshot".
- **Done when:** a post yields either a valid frozen snapshot or a clean invalid result; each `getComments` decrements the shared budget.

### 6. `session.selectSubreddit` Mutation (Hub only)

- **Target files:** `session.selectSubreddit` handler
- **Goal:** Validate and warm a Hub campaign selection without creating dashboard membership.
- **Scope:** reject from Community launches; resolve curated/custom display metadata (cache, then `getSubredditByName`, reject inaccessible/quarantined); lazy-warm page 1; return `{ activeSubreddit, currentRankIndex, subredditMetadata }` from the progress hash (default `1`).
- **Depends on:** 2, 3, 4.
- **References:** `002-api.md` "session.selectSubreddit mutation".
- **Done when:** validates + warms + returns metadata; rejected in Community; writes no dashboard membership to Redis (intended MVP gap preserved).

### 7. `puzzle.next` Mutation

- **Target files:** `puzzle.next` handler
- **Goal:** Resolve the player's position and emit the next playable puzzle or a safe continuation status.
- **Scope:**
  - Resolve effective subreddit from launch context; resolve `rankIndex` (Redis when logged-in, request body when logged-out).
  - The bounded evaluation loop sharing one budget across page warming (4) and comment validation (5); skip invalid posts by advancing progress; return `ready` / `exhausted` / `unplayable`.
  - Mint `puzzle:attempt` with frozen `owner` and shuffled `commentOrder`; strip scores and true order; include real comment IDs and `imageUrl` in the `ready` payload.
- **Depends on:** 2, 3, 4, 5.
- **References:** `002-api.md` "puzzle.next mutation" + "Serverless Work Budget"; `003-image-handling.md` §2.
- **Done when:** the status union is correct; the loop never exceeds the budget; persisted pages/cursors/skip progress let `unplayable` resume forward.

### 8. `puzzle.submit` Mutation

- **Target files:** `puzzle.submit` handler
- **Goal:** Finalize backend state transitions and data-mutation integrity before any UI is wired.
- **Scope:**
  - Non-mutating validation in order: slot permutation, attempt exists, not already submitted, host-lock match, owner match, progress not stale, snapshot exists.
  - Acquire `puzzle:submit-lock` via `SET NX EX 3600` only after validation; then score, persist `submitted: true`, and—for user-owned attempts only—`HINCRBY` stats, advance progress, and `ZADD ... GT CH` the leaderboard. Guest attempts compute `nextRankIndex` without writes.
  - Return the reveal payload with frozen scores.
- **Depends on:** 2, 3, 5, 7.
- **References:** `002-api.md` "puzzle.submit mutation", submit error table, atomic duplicate-submit guard.
- **Done when:** every error code returns correctly and non-mutatingly; duplicate submits are race-proof; leaderboard credit happens only on a successful user-owned submit.

### 9. `init` Query (read aggregator)

- **Target files:** `init` handler
- **Goal:** Hydrate entry state for Hub or Community launch from live data produced by the preceding steps.
- **Scope:** derive launch context; branch logged-in/out and Hub/Community; compute global Hive IQ; build the dashboard set as the union of `CURATED_SUBREDDITS` and custom subreddits discovered in the progress/stats hashes; resolve display metadata; fetch leaderboard ranks; return `InitResponse` (logged-out Hub → `dashboardSubreddits: null`).
- **Depends on:** 2, 3 (and metadata resolution from 4/6, leaderboard reads from 8).
- **References:** `002-api.md` "init query".
- **Done when:** Hub, Community, and logged-out branches return spec-correct `InitResponse`; dashboard cards render without a client-side metadata lookup.

---

## Phase C — Frontend

### 10. Frontend Gameplay Components & Dynamic Timer

- **Target files:** React client webview (game views and components)
- **Goal:** Implement client-side presentation cleanly, backed by a fully functional, testable API engine.
- **Scope:** Start Puzzle commitment gate; comments modal overlay; Tap-to-Rank with circled rank badges and clear-this-rank-and-above behavior; image rendering when `imageUrl` is present; the local timer calculation (`Math.ceil(combinedText.length / 5)` word heuristic, reading-rate buffer, hard `clamp(..., 30, 120)`); `M:SS` countdown shown only after the gate opens.
- **Depends on:** 1, 7 (`ready` payload shape).
- **References:** `004-puzzle-time-clock.md` §1–4; `003-image-handling.md` §3; `001-overview.md` UI Layout / Game Space.
- **Done when:** gate, modal, Tap-to-Rank, and countdown render against real `ready` payloads.

### 11. Frontend Integration, Auto-Submit, Unplayable Retry & Legacy Clean-Up

- **Target files:** React client webview (state machines, tRPC bindings)
- **Goal:** Glue the client journey to the backend endpoints and remove dead code.
- **Scope:**
  - Connect the countdown lifecycle to `puzzle.submit` via the fill-remaining strategy at `0:00`; auto-submit when all three ranks fill.
  - Handle `unplayable`: show loading copy, wait 500ms–1000ms, retry; on three consecutive failures render a "we encountered a problem" modal. Never tight-loop.
  - Strict legacy clean-up: remove all manual Skip Level UI, drag-and-drop contexts, and unused client-side tracking branches.
- **Depends on:** 7, 8, 10.
- **References:** `004-puzzle-time-clock.md` §4–5; `002-api.md` Client Gameplay Contract; `001-overview.md` "Unplayable retry".
- **Done when:** a full timed round submits and reveals; unplayable retries are paced and capped; no legacy drag-and-drop or skip code remains.

### 12. Hub Dashboard Construction & Custom Card Hydration

- **Target files:** `init` consumer + React client webview (Hub/Dashboard layouts)
- **Goal:** Finalize the app's entryway using the live data flows tested in preceding steps.
- **Scope:** build the Hub dashboard grid and main menu from `init.dashboardSubreddits`; render **Calibrating** until `completedRoundCount >= 3`; render fallback display text for custom campaigns without separate metadata calls; render the static `CURATED_SUBREDDITS` grid for logged-out Hub.
- **Depends on:** 9, 10.
- **References:** `002-api.md` "init query" + Shared Catalog; `001-overview.md` Dashboard Hub Menu.
- **Done when:** the Hub renders a live dashboard including custom cards; the logged-out Hub renders the static curated grid.
