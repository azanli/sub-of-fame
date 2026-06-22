---
# Sub of Fame — Locked Design Spec

## Core Loop

A text-based social-psychology puzzle.

1. Player sees a viral Reddit post (title/body).
2. Player drags three real top-level comment roots into popularity order (`#1` = most upvotes).
3. Slot-by-slot reveal $\rightarrow$ Next Puzzle $\rightarrow$ Repeat forever.
---

## Entry Points & Routing

Behavior is determined by `context.subredditName`:

- **App Hub (`r/SubOfFame`):** Main menu $\rightarrow$ player picks subreddit $\rightarrow$ locked for session.
- **Any other subreddit:** Skip picker $\rightarrow$ lock to that specific subreddit $\rightarrow$ launch puzzle #1 immediately.

> 📌 **Note:** `context.subredditName` always reflects the host subreddit, even when accessed from the Home Feed.

---

## Content Pipeline

- **Curation:** No manual curation, no decoys, no subscription API.
- **Snapshots:** Taken at puzzle creation—scores are frozen with no live verification. Shared across players via `puzzle:snapshot:{sourcePostId}`.
- **Timeframe Selection:** Weighted random selection:
- **Week:** ~10%
- **Month:** ~20%
- **Year:** ~30%
- **All-Time:** ~40%

- **Post Filters:** No NSFW/spoiler; usable title ($\ge 10$ chars) OR body ($\ge 50$ chars); must have $10+$ top-level comments.
- **Comment Extraction:** `getComments({ sort: 'top', depth: 1 })` $\rightarrow$ first 3 valid roots. Skip stickied/deleted/empty. Tie-break by `createdAt`.
- **Deduplication:**
- _Logged-in:_ Tracked via `user:{userId}:seen:{sub}` on source `t3_`. Recycle when exhausted.
- _Logged-out:_ None (repeats allowed).

- **Errors:** 5 internal retries $\rightarrow$ friendly empty state. Logged-in users can reset their seen set; Hub users can return to the main menu.

---

## Scoring & Reveal

- **Slot Accuracy:** 0–3 points per round ($1$ point per correct position).
- **Comment Batting Average:** $\frac{\text{correctSlots}}{\text{totalSlots}}$ (tracked globally + per-subreddit in the main menu).
- **Reveal Mechanics:** Green/red indicators per slot. Show frozen scores. _No client-side answers are exposed before submission._

---

## Session & State

| Feature             | Logged-in        | Logged-out                    |
| ------------------- | ---------------- | ----------------------------- |
| **Infinite Loop**   | ✅               | ✅                            |
| **Batting Average** | Redis (`userId`) | ❌                            |
| **Seen-set Dedup**  | Redis            | ❌                            |
| **Hub `activeSub**` | Redis            | ❌ _(must pick each session)_ |
| **Streaks / Push**  | ❌ _(v1)_        | ❌                            |

- **Hub Behavior:** Subreddit locks on pick; switch only via the main menu.
- **Community Behavior:** Subreddit is permanently locked to the host sub.

---

## UI Layout

### Splash (`splash.html`)

- Hook + subreddit badge + **Play** button.
- _No API calls, no stats shown here._

### Game (`game.html`)

- Vertical 1st/2nd/3rd slots.
- Draggable comment pool.
- Collapsible post body.
- Action buttons: **Menu** / **Submit** / **Next Puzzle**.

---

## API (Hono REST)

All types are located in `src/shared/api.ts`. Authentication is handled via Devvit context (no client tokens required).

- `GET  /api/init` $\rightarrow$ Bootstrap data (host sub, `isHub`, stats, `activeSub`).
- `POST /api/session/sub` $\rightarrow$ Hub only: lock chosen subreddit.
- `GET  /api/puzzle/next` $\rightarrow$ Shuffled puzzle data (excludes scores).
- `POST /api/puzzle/submit` $\rightarrow$ Evaluates score + reveals answers + persists state.

---

## Launch Topology & Positioning

### Topology

- Pinned hub post in `r/SubOfFame`.
- Community posts generated via mod menu (_"Create a new post"_).
- Single codebase utilizing routing based on `context.subredditName`.

### Hackathon Positioning

- **Not Trivia:** Players predict crowd behavior based on real Reddit threads.
- **User Contributions:** Drives organic community installs and active discussion directly on the posts.
- **Retention:** Batting average tracks long-term skill improvement (keeping scope lean without streaks in v1).

---

## Open Threads (Optional v2)

- Push notifications / streaks (utilizing Devvit beta).
- Per-subreddit leaderboards.
- Login prompt for logged-out players who want to save their stats.
- Direct link to the source Reddit thread after reveal.
- Toggle to show/hide comment authors.

---

### Suggested Build Order

A sensible build order is:

1. Shared types
2. Redis schema
3. `/api/puzzle/next` pipeline
4. Ranking UI
5. Submit/reveal mechanics
6. Main menu + hub routing
7. Splash polish
