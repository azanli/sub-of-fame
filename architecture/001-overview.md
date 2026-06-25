# Sub of Fame - Product & System Spec

## Core Loop

A text-based social-psychology puzzle built around a linear subreddit campaign.

1. Player sees a viral Reddit post (title/body) pulled sequentially from the subreddit's live all-time top ladder cache. Comments stay hidden until the player commits.
2. Player taps **Start Puzzle**, reads three real top-level comment roots under a client-calculated countdown, and Tap-to-Ranks them into popularity order (`#1` = most upvotes).
3. Auto-submit (or timeout force-submit) -> slot-by-slot reveal -> next reachable ladder rank -> repeat until the ladder is conquered.

---

## Entry Points & Routing

Behavior is determined by `context.subredditName`:

- **App Hub (`r/SubOfFame`):** Dashboard main menu -> player views stats/level badges -> picks a subreddit campaign.
- **Any other subreddit (Community Post):** Skip dashboard -> lock to host sub campaign -> launch player's current sequential puzzle immediately.

Note: `context.subredditName` always reflects the host subreddit, even when accessed from the Home Feed.

Community host locking is a backend invariant, not a UI convention. In the App Hub, gameplay procedures may use the subreddit selected by the player. In a Community Post, gameplay procedures resolve the campaign from `context.subredditName`; client-provided subreddit names are only accepted if they match the host subreddit after normalization. This prevents a post installed in `r/example` from launching or submitting gameplay for `r/askreddit`.

---

## Content Pipeline & Caching

- **Curation:** No manual curation, no decoys.
- **Campaign Source:** Each subreddit campaign is a live ladder sourced from the subreddit's all-time top posts.
- **MVP Ladder Semantics:** `rankIndex` means the player's current/next playable rank in the current cached ladder, not a permanent canonical post identity. Because invalid posts are skipped, `rankIndex` is a reachability pointer, not a count of puzzles solved or leaderboard credit earned.
- **Ladder Cache:** Reddit post metadata is cached in cursor-linked chunks so gameplay avoids repeated live top-list fetches. Because all-time top posts are near-static historical data, page content is cached for several days and the cursor chain that links pages is persisted durably and separately, so reaching a deep rank on a cold content cache re-fetches a single page directly instead of re-walking from page 1. Ranks beyond the first 100 are reached by following cached Reddit listing cursors, not by random-access page fetches.
- **Post Prefilters:** No NSFW; no spoiler; usable title or body; minimum Reddit total comment count as a cheap discussion-volume hint. This hint is not proof of playability because Reddit's public comment count includes replies and unavailable comments.
- **Skip Behavior:** Invalid posts are skipped by advancing the player's linear progress pointer. A single shared work budget governs both ladder page warming and comment validation within one `puzzle.next` call, so the procedure provably stays under the serverless time limit; when the budget is spent before a playable post is found, the call returns `{ status: 'unplayable', rankIndex }`. Persisted pages and progress let the next call resume forward. See **Unplayable retry** under Game Space for required client handling—never tight-loop `puzzle.next` on this status.
- **Authoritative Comment Gate:** A post is playable only if a `depth: 1` top-comment fetch can produce three valid top-level comment roots with distinct scores, without deep pagination. The backend freezes the true answer order in a short-lived snapshot before returning a shuffled presentation order.
- **Comment Validity:** A playable comment must be a real, visible user comment with meaningful text and an available numeric score. Deleted/removed comments, AutoModerator/system-style comments, stickied/mod-distinguished comments, empty bodies, and very short bodies are excluded.
- **Ambiguous Rankings:** If score data is unavailable, or if the selected top three comments would contain tied scores, the post is treated as invalid and skipped. This keeps the puzzle about social prediction rather than hidden backend tie-breakers.

Canonical cache keys, TTLs, snapshot shapes, attempt shapes, and exact validation contracts live in `002-api.md`.

---

## Scoring & Player Metrics

- **Slot Accuracy:** 0-3 points per round, with 1 point per correctly placed comment.
- **Personal Hive IQ Metric:** A logged-in player's long-term slot accuracy, shown across all subreddits and per subreddit after at least one submitted round in that scope. In product copy, always label this as personal: **Your Global Hive IQ** means the player's all-time accuracy across every subreddit they have played, while **Your r/{subreddit} Hive IQ** means that player's accuracy in one subreddit. Before any submitted round in a scope, Hive IQ is not yet measured.
- **Accuracy Warm-Up:** Dashboard accuracy strings are suppressed until the player has completed at least 3 rounds in that scope. During this warm-up state, display **Calibrating** instead of a percentage.
- **Global Leaderboards:** Subreddit-specific standings based on the furthest playable ladder rank a logged-in player has cleared by submitting a valid puzzle. Leaderboard scores store the cleared playable rank itself, not the player's next-playable progress pointer. Invalid-post skips may advance the player's current `rankIndex`, but they do not create or advance leaderboard credit by themselves. For MVP, these remain casual social progress rankings because cached ladder refreshes mean the source ladder is not a permanent competitive archive.
- **Reveal Mechanics:** Green/red indicators per slot. Show frozen historical scores after submission. For hackathon MVP, pre-submit comment cards may include real Reddit comment IDs for Tap-to-Rank identity, but not the true answer order or frozen scores; the game accepts casual trust rather than preventing external lookup.
- **Puzzle Timer:** Allotted time is calculated on the client from comment body length when the puzzle loads; it is not returned by the API. See `004-puzzle-time-clock.md`.

The MVP does not define a collective all-player Hive IQ. If crowd aggregate stats are added later, they should use separate aggregate counters and distinct copy such as **Crowd Accuracy** or **The Hive's Read**, not the personal `user:{userId}:stats` counters. The scoring formula, statistics counters, and leaderboard storage contract are defined in `002-api.md`.

---

## Session & State

| Feature                    | Logged-in                      | Logged-out                     |
| :------------------------- | :----------------------------- | :----------------------------- |
| **Progression Map**        | Persisted per subreddit        | Client state / request context |
| **Personal Hive IQ Stats** | Persisted profile stats        | Not persisted                  |
| **Global Leaderboards**    | Eligible for subreddit ranking | Not eligible                   |
| **Active Hub Session**     | Ephemeral client state         | Ephemeral client state         |

- **Hub Session Behavior:** Subreddit locks on select for active runtime loop. Exiting to the Dashboard resets active selection.
- **Custom Subreddit Sync Window (intentional MVP):** `session.selectSubreddit` validates a custom request, warms page 1, and returns metadata, but **does not** write dashboard membership to Redis. A custom subreddit appears on the Hub dashboard only after persisted progress or stats exist—typically from a submitted round or a backend validation skip during `puzzle.next`. If a logged-in player validates a custom subreddit, enters gameplay, then closes the app or loses connection **before** submit (and before any backend skip advances their progress), that subreddit **will not** reappear on the dashboard on the next `init`. This is expected hackathon behavior, not a bug. Do **not** implement a persisted "recently searched" or "recent custom subreddits" list to paper over this gap.
- **Community Session Behavior:** The active campaign is the host subreddit and bypasses Hub selection. The server re-derives this lock from Devvit context on `init`, `puzzle.next`, and `puzzle.submit`; the client cannot switch campaigns from a Community launch.
- **Attempt Ownership:** A round's auth mode is frozen when the puzzle is served. Logged-in rounds belong to that user and can only be submitted by that same user. Logged-out rounds are guest rounds, even if the player signs in before pressing submit.
- **Auth-State Changes:** For MVP, a guest round submitted after sign-in still reveals and returns guest-only next progress, but does not update profile stats, persisted progress, or leaderboards. Continuing while signed in requests the account's authoritative next puzzle. A logged-in round submitted after logout or account switch is rejected and the client refreshes to the current authoritative puzzle.

---

## UI Layout

### Dashboard Hub Menu (`splash.html` / Dashboard)

- Displays **Your Global Hive IQ** from the logged-in user's submitted rounds across all subreddits when available, otherwise an unplayed empty state.
- Displays per-subreddit dashboard rows as the buttons to enter campaigns. Each row contains:
  - subreddit avatar on the left
  - `r/{subredditName}` label
  - accuracy metric in the top-right, shown as **Calibrating** until completed rounds >= 3 (🎯 66.7%)
  - completed puzzle count in the bottom-right (# Puzzles Solved)
- Hub cold boot has no active campaign; dashboard data must not depend on active-subreddit metrics.
- Scrollable grid of curated subreddit cards plus logged-in custom subreddit cards that have persisted player progress or stats. Custom cards appear after the player has submitted a round or a validation skip has advanced their persisted progress in that subreddit; a validated custom request with no persisted progress or stats does not need to remain as a dashboard card for MVP.
- Text input bar for **Custom Subreddit Requests**.
- Custom requests call `session.selectSubreddit`, which validates the subreddit and returns display metadata for the active gameplay session. The text bar is a launch path, not a save action: abandoning gameplay before submit leaves no Redis footprint, so the custom subreddit disappears from the dashboard on return. See **Custom Subreddit Sync Window** under Session & State.
- When logged-out Hub `init` returns `dashboardSubreddits: null`, the client renders the curated grid from the static `CURATED_SUBREDDITS` catalog with no user badges, progress, Hive IQ, or leaderboard rank.

### Game Space (`game.html`)

See `004-puzzle-time-clock.md` for the full interaction contract.

**Pre-start (commitment gate)**

- Source post title, body, and optional image only (full read window; not collapsible).
- Three comments hidden.
- Primary action: **Start Puzzle**.

**Active puzzle (after Start Puzzle)**

- Post remains visible underneath; a **comments modal** overlays it with the three comment cards and Tap-to-Rank UI. The player does not re-read or collapse the post body during the timed phase.
- Client-side countdown timer (`M:SS`), started at gate open from comment-length calculation (30s–120s clamp).
- Tap-to-Rank with circled rank badges (`①` `②` `③`) inside the modal.
- Tapping a selected comment clears that rank and all higher ranks; lower ranks stay in place (e.g. tap `②` → only `②` clears, `①` stays).
- Auto-submit when all three ranks are filled; on timeout, force-submit via the client fill-remaining strategy (see `004-puzzle-time-clock.md`).

**Post-submit**

- Slot reveal (green/red) with frozen scores.
- Actions: **Dashboard/Menu** / **Next Level**.

**Unplayable retry (`puzzle.next`)**

When `puzzle.next` returns `{ status: 'unplayable', rankIndex }`, the server ran out of work budget while hunting for a playable post. The response is a continuation point, not an error—but the client must **not** immediately auto-retry in the same tick. A zero-delay loop would hammer the backend and serverless bill on subreddits with long runs of deleted, tied, or otherwise invalid top posts.

Required client behavior:

1. Show a brief native loading state, e.g. **"Searching deeper for a worthy puzzle..."**
2. Wait **500ms–1000ms** before calling `puzzle.next` again (use the returned `rankIndex`; logged-in clients omit it and let Redis progress drive the next call).
3. Repeat until the response is `ready` or `exhausted`.

The delay gives persisted ladder warming and skip progress from the prior invocation time to catch up before the next serverless run.

**Removed from MVP**

- Drag-and-drop ranking UI.
- Manual **Skip Level** controls (ladder progression is strictly sequential).

---

## API (Hono-hosted tRPC)

Auth is handled via Devvit context. Hono hosts the Devvit web server, but gameplay calls are tRPC procedures with shared TypeScript input/output contracts. This section describes procedure purpose only; exact contracts live in `002-api.md`.

- `init` query -> Hydrates entry state for Hub or Community launch.
- `session.selectSubreddit` mutation -> Validates a Hub campaign selection and prepares the campaign. This is unavailable from Community launches.
- `puzzle.next` mutation -> Resolves the effective subreddit from launch context, then resolves the player's current ladder position and returns the next playable puzzle.
- `puzzle.submit` mutation -> Validates an active attempt against launch context, acquires the Redis duplicate-submit lock for the attempt, scores a guess, reveals the frozen answer data, updates progression, and refreshes metrics according to the attempt owner frozen at puzzle creation. Expired, stale, duplicate, invalid, cross-user, and host-mismatched submissions fail without changing progress or stats. The API contract in `002-api.md` owns the exact atomic `SET NX EX` guard.

---

## Build Order

1. **Shared Types (`src/shared/api.ts` + `subreddits.ts` allowlist array)**
2. **Redis Layer Schema Configuration (Progress hash, Profile Stats hash, Leaderboard ZSET)**
3. **The Cursor-Linked Live Ladder Cache Pipeline (`session.selectSubreddit` validation + page warming loop)**
4. **The Safe `puzzle.next` Loop (Validation checks, skip limits, and attempt emission)**
5. **Tap-to-Rank Frontend UI, Start Puzzle Gate & Client Timer** (`004-puzzle-time-clock.md`)
6. **Submission Verification Procedure (`puzzle.submit`)**
7. **Hub Statistics Dashboard Construction & Polishing**
