# Sub of Fame - Product & System Spec

## Core Loop

A text-based social-psychology puzzle built around a linear subreddit campaign.

1. Player sees a viral Reddit post (title/body) pulled sequentially from the subreddit's all-time top list.
2. Player drags three real top-level comment roots into popularity order (`#1` = most upvotes).
3. Slot-by-slot reveal -> Next ladder milestone -> Repeat until the ladder is conquered.

---

## Entry Points & Routing

Behavior is determined by `context.subredditName`:

- **App Hub (`r/SubOfFame`):** Dashboard main menu -> player views stats/level badges -> picks a subreddit campaign.
- **Any other subreddit (Community Post):** Skip dashboard -> lock to host sub campaign -> launch player's current sequential puzzle immediately.

Note: `context.subredditName` always reflects the host subreddit, even when accessed from the Home Feed.

---

## Content Pipeline & Caching

- **Curation:** No manual curation, no decoys.
- **Campaign Source:** Each subreddit campaign is a deterministic ladder based on all-time top posts.
- **Ladder Cache:** Reddit post metadata is cached in paged chunks so gameplay does not depend on repeated live top-list fetches.
- **Post Filters:** No NSFW; no spoiler; usable title or body; enough top-level comments to build a puzzle.
- **Skip Behavior:** Invalid posts are skipped by advancing the player's linear progress pointer. A bounded validation loop prevents serverless timeouts.
- **Comment Extraction:** Use the top-level comment roots sorted by popularity. The backend freezes the true answer order in a snapshot before returning a shuffled presentation order.

Canonical cache keys, TTLs, snapshot shapes, attempt shapes, and exact validation contracts live in `002-dataTypes.md`.

---

## Scoring & Global Analytics

- **Slot Accuracy:** 0-3 points per round, with 1 point per correctly placed comment.
- **Hive IQ Metric:** Long-term slot accuracy shown globally and per subreddit.
- **Global Leaderboards:** Subreddit-specific standings based on highest cleared ladder milestone.
- **Reveal Mechanics:** Green/red indicators per slot. Show frozen historical scores. No client-side answers or correct IDs are exposed before submission.

The scoring formula, statistics counters, and leaderboard storage contract are defined in `002-dataTypes.md`.

---

## Session & State

| Feature                 | Logged-in                      | Logged-out                     |
| :---------------------- | :----------------------------- | :----------------------------- |
| **Progression Map**     | Persisted per subreddit        | Client state / request context |
| **Hive IQ Stats**       | Persisted profile stats        | Not persisted                  |
| **Global Leaderboards** | Eligible for subreddit ranking | Not eligible                   |
| **Active Hub Session**  | Ephemeral client state         | Ephemeral client state         |

- **Hub Session Behavior:** Subreddit locks on select for active runtime loop. Exiting to the Dashboard resets active selection.
- **Community Session Behavior:** The active campaign is the host subreddit and bypasses Hub selection.

---

## UI Layout

### Dashboard Hub Menu (`splash.html` / Dashboard)

- Displays user's **Global Hive IQ**, per-subreddit level badges derived from `currentRankIndex`, and leaderboard rank badges.
- Scrollable grid of curated subreddits + text input bar for **Custom Subreddit Requests**.
- Custom requests validate the subreddit before initializing the campaign.

### Game Space (`game.html`)

- Vertical 1st/2nd/3rd slots.
- Draggable comment pool card objects.
- Collapsible post text body.
- Actions: **Dashboard/Menu** / **Submit Guess** / **Next Level**.

---

## API (Hono REST)

Auth is handled via Devvit context. This section describes endpoint purpose only; exact request/response contracts live in `002-dataTypes.md` and `src/shared/api.ts`.

- `GET /api/init` -> Hydrates entry state for Hub or Community launch.
- `POST /api/session/sub` -> Validates a Hub campaign selection and prepares the campaign.
- `POST /api/puzzle/next` -> Resolves the player's current ladder position and returns the next playable puzzle.
- `POST /api/puzzle/submit` -> Scores a guess, reveals the frozen answer data, updates progression, and refreshes metrics.

---

## Build Order

1. **Shared Types (`src/shared/api.ts` + `subreddits.ts` allowlist array)**
2. **Redis Layer Schema Configuration (Progress hash, Profile Stats hash, Leaderboard ZSET)**
3. **The Ladder Cache Pagination Pipeline (`/api/session/sub` validation + caching loop)**
4. **The Safe `/api/puzzle/next` Loop (Validation checks, skip limits, and attempt emission)**
5. **Drag-and-Drop Rank Frontend UI**
6. **Submission Verification Endpoint (`/api/puzzle/submit`)**
7. **Hub Statistics Dashboard Construction & Polishing**
