# Sub of Fame — Data Types & Redis Schema

Companion to `001-specs.md`. Defines shared TypeScript types (`src/shared/api.ts`), Redis keys, and API request/response contracts for the linear progression model.

---

## Design Principles

| Principle             | Decision                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Progression           | Linear rank pointer per subreddit (`rankIndex`), not a seen-set                                   |
| Submit correlation    | Server-issued `attemptId` bound to `rankIndex`                                                    |
| Truth vs presentation | `PuzzleSnapshot` = true rank order; `PuzzleAttempt` = shuffled IDs                                |
| User guess            | Presentation indices into the shuffled layout                                                     |
| Logged-out rank       | Client-authoritative; server ignores client rank when logged-in                                   |
| Skip persistence      | Invalid posts increment progress permanently (logged-in: Redis; logged-out: returned `rankIndex`) |
| Hive IQ               | `(correctSlots / totalSlots) × 100`, computed at read time                                        |
| Hub session           | `activeSubreddit` is ephemeral client state; `/api/init` returns `null` on cold boot              |

---

## Shared Catalog (`src/shared/subreddits.ts`)

```typescript
export type SubredditOption = {
  name: string; // lowercase internal key, e.g. 'askreddit'
  displayName: string; // presentation name, e.g. 'AskReddit'
  description: string; // brief thematic hook
};

export const CURATED_SUBREDDITS: SubredditOption[] = [
  {
    name: 'askreddit',
    displayName: 'AskReddit',
    description: 'Predict the collective human experience.',
  },
  {
    name: 'gaming',
    displayName: 'Gaming',
    description: 'Test your knowledge on crowd gaming culture.',
  },
  // ... top 10 choices
];
```

Client-side merge for Hub dashboard (not an API type):

```typescript
type SubredditPickerItem = SubredditOption & {
  currentRankIndex: number | null; // null = never played
  subredditHiveIQ: number | null;
};
```

Custom subreddits: validated live on `POST /api/session/sub` via `getSubredditByName`, with lazy ladder cache warm on first play.

---

## Redis Schema

### User Progress (logged-in only)

| Key                      | Type | Fields                                                      |
| ------------------------ | ---- | ----------------------------------------------------------- |
| `user:{userId}:progress` | Hash | `{ [subredditName]: rankIndex }` (integer strings, 1-based) |

- Default `rankIndex` for unseen subs: `1`
- Incremented on: invalid-post skips during `/api/puzzle/next`, successful submit (`INCR` by 1)

### User Statistics (logged-in only)

| Key                   | Type | Fields                                                                                       |
| --------------------- | ---- | -------------------------------------------------------------------------------------------- |
| `user:{userId}:stats` | Hash | `global:correct`, `global:total`, `sub:{subredditName}:correct`, `sub:{subredditName}:total` |

- Updated via atomic `HINCRBY` on each submission
- `global:total` and `sub:*:total` increment by 3 per round; `*:correct` increment by score (0–3)

### Subreddit Leaderboard (logged-in only)

| Key                           | Type       | Score                               | Member   |
| ----------------------------- | ---------- | ----------------------------------- | -------- |
| `leaderboard:{subredditName}` | Sorted Set | `rankIndex` (ladder height reached) | `userId` |

- Updated on successful submit: `ZADD leaderboard:{sub} CH {nextRankIndex} {userId}`
- Ties accepted at Redis layer; Hive IQ breaks ties at display time only

### Ladder Cache (shared)

| Key                                 | Type         | TTL |
| ----------------------------------- | ------------ | --- |
| `sub:ladder:{subredditName}:{page}` | List of JSON | 24h |

Page mapping: page 1 = ranks 1–100, page 2 = 101–200, etc.

```typescript
type LadderPostSummary = {
  id: string; // t3_...
  title: string;
  hasBody: boolean; // body length >= 50
  isNSFW: boolean;
  isSpoiler: boolean;
  commentCount: number; // must be >= 10
};

type EpisodeCachePage = LadderPostSummary[];
```

Lookup: `page = Math.ceil(rankIndex / 100)`, `offset = (rankIndex - 1) % 100`

Lazy fetch on cache miss: `getTopPosts({ subredditName, time: 'all', limit: 100 })` → populate page key.

Title validation: `title.length >= 10` OR `hasBody === true`.

### Puzzle Snapshot (shared, comment truth)

| Key                              | Type        | TTL |
| -------------------------------- | ----------- | --- |
| `puzzle:snapshot:{sourcePostId}` | JSON string | 24h |

```typescript
type PuzzleCommentSnapshot = {
  id: string; // t1_...
  body: string;
  score: number; // frozen upvotes at snapshot time
  createdAt: number;
};

type PuzzleSnapshot = {
  sourcePostId: string;
  post: { title: string; body?: string };
  comments: [
    PuzzleCommentSnapshot,
    PuzzleCommentSnapshot,
    PuzzleCommentSnapshot,
  ];
  // index 0 = #1 most upvotes (true rank); never scrambled
  createdAt: number;
  expiresAt: number;
};
```

Created on first valid post after comment extraction (`getComments({ sort: 'top', depth: 1 })` → first 3 valid roots, tie-break by `createdAt`).

### Puzzle Attempt (ephemeral, per round)

| Key                          | Type        | TTL |
| ---------------------------- | ----------- | --- |
| `puzzle:attempt:{attemptId}` | JSON string | ~1h |

```typescript
type PuzzleAttempt = {
  attemptId: string;
  sourcePostId: string;
  subreddit: string;
  rankIndex: number;
  userId?: string;
  commentOrder: [string, string, string]; // shuffled presentation order
  submitted: boolean;
  createdAt: number;
  expiresAt: number;
};
```

---

## Shared API Types (`src/shared/api.ts`)

### Stats & Metrics

```typescript
type PerformanceCounters = {
  correctSlots: number;
  totalSlots: number;
};

export type UserStatsProfile = {
  global: PerformanceCounters;
  bySubreddit: Record<string, PerformanceCounters>;
};

export type HiveIQMetrics = {
  globalHiveIQ: number; // (global:correct / global:total) * 100
  subredditHiveIQ: number; // (sub:correct / sub:total) * 100
  currentRankIndex: number; // ladder height on active sub
};
```

### Leaderboard (read-time)

```typescript
export type LeaderboardEntry = {
  userId: string;
  rankIndex: number;
  subredditHiveIQ: number; // hydrated from stats hash
  displayRank: number; // tied users share displayRank
};
```

### Init & Session

```typescript
export type InitResponse = {
  hostSubreddit: string;
  isHub: boolean;
  activeSubreddit: string | null; // null on Hub boot; hostSubreddit in Community
  hiveIQ: HiveIQMetrics | null; // null when logged-out
  progress: Record<string, number> | null; // null when logged-out; sub → rankIndex
};

export type SessionSubRequest = {
  subreddit: string;
};

export type SessionSubResponse = {
  activeSubreddit: string;
  currentRankIndex: number;
};

export type SessionSubError = {
  status: 'error';
  message: string; // e.g. "Subreddit does not exist or is inaccessible."
};
```

### Puzzle Flow

```typescript
export type PuzzleNextRequest = {
  subreddit: string;
  rankIndex?: number; // logged-out only; ignored when logged-in
};

export type PuzzleNextResponse =
  | {
      status: 'ready';
      attemptId: string;
      rankIndex: number;
      post: { title: string; body?: string };
      comments: Array<{ id: string; body: string }>; // shuffled, no scores
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

export type PuzzleSubmitRequest = {
  attemptId: string;
  slots: [number, number, number]; // presentation indices → slot 1/2/3
};

export type PuzzleSubmitResponse = {
  score: number; // 0–3
  slots: Array<{
    commentId: string;
    body: string;
    score: number;
    correct: boolean;
  }>;
  hiveIQ: HiveIQMetrics | null; // null when logged-out
  nextRankIndex: number; // for logged-out client progression sync
};
```

---

## API Execution Flows

### `GET /api/init`

1. Derive `isHub` from `context.subredditName === 'SubOfFame'`.
2. If logged-out → `hiveIQ: null`, `progress: null`.
3. If logged-in → parallel fetch `user:{userId}:progress` + `user:{userId}:stats`.
4. Set `activeSubreddit`: Community → `hostSubreddit`; Hub → `null`.
5. Compute `HiveIQMetrics` from stats hash at read time.

### `POST /api/session/sub` (Hub only)

1. Sanitize input (strip `r/`, lowercase, trim).
2. Match against `CURATED_SUBREDDITS` → proceed if found.
3. Else → `getSubredditByName`; reject if inaccessible/quarantined.
4. Lazy-warm `sub:ladder:{sub}:1` if missing.
5. Return `{ activeSubreddit, currentRankIndex }` from progress hash (default `1`).

### `POST /api/puzzle/next`

1. Resolve `rankIndex`: logged-in → Redis progress; logged-out → request body value (default `1`).
2. Initialize `itemsChecked = 0`.
3. **Evaluation loop** (max 20 iterations):
   - Read post from `sub:ladder:{sub}:{page}` at offset.
   - If no post exists → return `{ status: 'exhausted' }`.
   - Fast-filter via `LadderPostSummary` (NSFW, spoiler, title/body, commentCount).
   - If invalid → increment progress pointer (Redis if logged-in), `itemsChecked++`, continue.
   - If `itemsChecked >= 20` → return `{ status: 'unplayable' }`.
   - Load or create `PuzzleSnapshot` (comment validation).
   - If comment extraction fails → treat as invalid (skip + increment).
4. Mint `puzzle:attempt:{attemptId}` with shuffled `commentOrder`.
5. Return `{ status: 'ready', attemptId, rankIndex, post, comments }` (no scores).

### `POST /api/puzzle/submit`

1. Load `PuzzleAttempt` by `attemptId`; reject if missing or already submitted.
2. Load `PuzzleSnapshot` by `sourcePostId`.
3. Score: for each slot `i`, resolve `attempt.commentOrder[slots[i]]` vs `snapshot.comments[i].id` → 1 point per match.
4. Mark attempt `submitted: true`.
5. If logged-in:
   - `HINCRBY` stats counters.
   - `HINCR` progress for active sub.
   - `ZADD leaderboard:{sub} CH {nextRankIndex} {userId}`.
6. Return reveal payload with frozen scores + updated Hive IQ.

---

## Scoring Reference

```
slotScore = count of i where attempt.commentOrder[slots[i]] === snapshot.comments[i].id
hiveIQ = (correctSlots / totalSlots) * 100
```

Submit validates `slots` is a permutation of `[0, 1, 2]`.

---

## Build Order (from `001-specs.md`, updated)

1. **Shared types** — `src/shared/api.ts`, `src/shared/subreddits.ts`
2. **Redis schema** — helpers for progress, stats, ladder, snapshot, attempt keys
3. **`POST /api/puzzle/next`** — ladder cache + validation loop + snapshot pipeline
4. **Ranking UI** — drag-and-drop slots, shuffled comment pool
5. **`POST /api/puzzle/submit`** — scoring, reveal, Hive IQ + leaderboard writes
6. **Main menu + hub routing** — init dashboard, session/sub picker, community bypass
7. **Splash polish**
