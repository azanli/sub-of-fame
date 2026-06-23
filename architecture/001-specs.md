# Sub of Fame — Locked Design Spec

## Core Loop

A text-based social-psychology puzzle mapping a linear progression campaign.

1. Player sees a viral Reddit post (title/body) pulled sequentially from the subreddit's all-time top list.
2. Player drags three real top-level comment roots into popularity order (`#1` = most upvotes).
3. Slot-by-slot reveal $\rightarrow$ Next Ladder Milestone $\rightarrow$ Repeat until the ladder is conquered.

---

## Entry Points & Routing

Behavior is determined by `context.subredditName`:

- **App Hub (`r/SubOfFame`):** Dashboard main menu $\rightarrow$ player views stats/level badges $\rightarrow$ picks a subreddit campaign.
- **Any other subreddit (Community Post):** Skip dashboard $\rightarrow$ lock to host sub campaign $\rightarrow$ launch player's current sequential puzzle immediately.

> 📌 **Note:** `context.subredditName` always reflects the host subreddit, even when accessed from the Home Feed.

---

## Content Pipeline & Caching

- **Curation:** No manual curation, no decoys.
- **The Ladder Cache:** Cached in 100-item chunks via Redis lists at `sub:ladder:{subredditName}:{page}` with a 24-hour TTL. To prevent real-time bottlenecks, pages store lightweight metadata objects (`LadderPostSummary`) rather than just raw IDs:
  ```typescript
  type LadderPostSummary = {
    id: string;
    title: string;
    hasBody: boolean;
    isNSFW: boolean;
    isSpoiler: boolean;
    commentCount: number;
  };
  ```
- **Post Filters (Validation Loop):** No NSFW; no spoiler; usable title ($\ge 10$ chars) OR body ($\ge 50$ chars); must have $10+$ top-level comments.
- **The Loop Ceiling / Skip Cap:** If a post fails filters, the loop automatically increments the user's progress index and evaluates the next sequential post. To prevent execution timeouts, the loop checks a **maximum of 20 posts** before returning an unplayable state.
- **Comment Extraction:** `getComments({ sort: 'top', depth: 1 })` $\rightarrow$ first 3 valid roots. Skip stickied/deleted/empty. Tie-break strictly by `createdAt` on the backend snapshot.

---

## Scoring & Global Analytics

- **Slot Accuracy:** 0–3 points per round ($1$ point per correct position).
- **Hive IQ Metric:** Programmatically derived at read-time via $\left(\frac{\text{correctSlots}}{\text{totalSlots}}\right) \times 100$. Updated atomically via Redis hashes.
- **Global Leaderboards:** Subreddit-specific standings sorted natively via a Redis Sorted Set (`leaderboard:{subredditName}`). The score stored is the user's highest cleared integer `rankIndex`.
- **Reveal Mechanics:** Green/red indicators per slot. Show frozen historical scores. _No client-side answers or correct IDs are exposed before submission._

---

## Session & State

| Feature                 | Logged-in                                       | Logged-out                                   |
| :---------------------- | :---------------------------------------------- | :------------------------------------------- |
| **Progression Map**     | Redis Campaign Index (`user:{userId}:progress`) | Client State / Context (Reset on fresh boot) |
| **Hive IQ Stats**       | Redis Profile Hash (`user:{userId}:stats`)      | ❌                                           |
| **Global Leaderboards** | Redis Sorted Set (`leaderboard:{sub}`)          | ❌                                           |
| **Active Hub Session**  | Ephemeral Client State (Defaults to Dashboard)  | Ephemeral Client State                       |

- **Hub Session Behavior:** Subreddit locks on select for active runtime loop. Exiting to the Dashboard resets active selection.

---

## UI Layout

### Dashboard Hub Menu (`splash.html` / Dashboard)

- Displays user's **Global Hive IQ** + leaderboard rank badges.
- Scrollable grid of curated subreddits + text input bar for **Custom Subreddit Requests**.
- Custom requests execute a serialization and live check lookup (`context.reddit.getSubredditByName`) on submit before initialization.

### Game Space (`game.html`)

- Vertical 1st/2nd/3rd slots.
- Draggable comment pool card objects.
- Collapsible post text body.
- Actions: **Dashboard/Menu** / **Submit Guess** / **Next Level**.

---

## API (Hono REST)

All types located in `src/shared/api.ts`. Auth via Devvit context.

- `GET  /api/init` $\rightarrow$ Hydrates the main dashboard (host sub, `isHub`, global `HiveIQMetrics`, full `progress` map). Enforces a clean menu state on Hub launch by defaulting `activeSubreddit` to `null`.
- `POST /api/session/sub` $\rightarrow$ Sanitizes and validates a target campaign request. Triggers lazy-loading of the ladder cache page if missing.
- `POST /api/puzzle/next` $\rightarrow$ Resolves target index from the request body against the filter loop. Returns an ephemeral `attemptId` bound to a localized scrambled array of comment strings.
- `POST /api/puzzle/submit` $\rightarrow$ Receives array indices payload `{ attemptId, slots: [number, number, number] }`. Evaluates, logs profile stats, updates leaderboard position, and issues an atomic `INCR` to progress.

---

## Finalized API Types (`src/shared/api.ts`)

```typescript
export type HiveIQMetrics = {
  globalHiveIQ: number;
  subredditHiveIQ: number;
  currentRankIndex: number;
};

export type InitResponse = {
  hostSubreddit: string;
  isHub: boolean;
  activeSubreddit: string | null;
  hiveIQ: HiveIQMetrics | null;
  progress: Record<string, number> | null;
};

export type PuzzleNextResponse =
  | {
      status: 'ready';
      attemptId: string;
      rankIndex: number;
      post: { title: string; body?: string };
      comments: Array<{ id: string; body: string }>;
    }
  | {
      status: 'exhausted';
      rankIndex: number;
      message: string;
    }
  | {
      status: 'unplayable';
      rankIndex: number;
      message: string;
    };
```

---

### Revised Build Order

1. **Shared Types (`src/shared/api.ts` + `subreddits.ts` allowlist array)**
2. **Redis Layer Schema Configuration (Progress hash, Profile Stats hash, Leaderboard ZSET)**
3. **The Ladder Cache Pagination Pipeline (`/api/session/sub` validation + caching loop)**
4. **The Safe `/api/puzzle/next` Loop (Validation checks, skip limits, and attempt emission)**
5. **Drag-and-Drop Rank Frontend UI**
6. **Submission Verification Endpoint (`/api/puzzle/submit`)**
7. **Hub Statistics Dashboard Construction & Polishing**
