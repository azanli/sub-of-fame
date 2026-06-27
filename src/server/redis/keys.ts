// Pure key and field builder functions. No Redis import — callers pass results
// to the appropriate Redis client methods. Subreddit segments are expected to be
// pre-normalized (lowercase, stripped of r/ prefix) by the caller.

// ─── TTL Constants (seconds) ──────────────────────────────────────────────────

export const METADATA_TTL_S = 7 * 24 * 60 * 60; // 7 days
export const LADDER_PAGE_TTL_S = 7 * 24 * 60 * 60; // 7 days
export const LADDER_CURSORS_TTL_S = 30 * 24 * 60 * 60; // 30 days
export const SNAPSHOT_TTL_S = 7 * 24 * 60 * 60; // 7 days
export const ATTEMPT_TTL_S = 60 * 60; // 1 hour
export const SUBMIT_LOCK_TTL_S = 60 * 60; // 1 hour

// ─── Key Builders ─────────────────────────────────────────────────────────────

/** `user:{userId}:progress` — hash of subredditName → rankIndex (integer string) */
export const progressKey = (userId: string): string => `user:${userId}:progress`;

/** `user:{userId}:stats` — hash of stat fields → counter (integer string) */
export const statsKey = (userId: string): string => `user:${userId}:stats`;

/** `leaderboard:{subredditName}` — sorted set of userId → bestClearedRankIndex */
export const leaderboardKey = (subredditName: string): string =>
  `leaderboard:${subredditName}`;

/** `sub:metadata:{subredditName}` — JSON string, TTL 7d */
export const metadataKey = (subredditName: string): string =>
  `sub:metadata:${subredditName}`;

/** `sub:ladder:{subredditName}:{page}` — JSON string, TTL 7d */
export const ladderPageKey = (subredditName: string, page: number): string =>
  `sub:ladder:${subredditName}:${page}`;

/** `sub:ladder:{subredditName}:cursors` — JSON string, TTL 30d */
export const ladderCursorsKey = (subredditName: string): string =>
  `sub:ladder:${subredditName}:cursors`;

/** `puzzle:snapshot:{sourcePostId}` — JSON string, TTL 7d */
export const snapshotKey = (sourcePostId: string): string =>
  `puzzle:snapshot:${sourcePostId}`;

/** `puzzle:attempt:{attemptId}` — JSON string, TTL ~1h */
export const attemptKey = (attemptId: string): string =>
  `puzzle:attempt:${attemptId}`;

/** `puzzle:submit-lock:{attemptId}` — string lock, TTL 1h, acquired with SET NX EX */
export const submitLockKey = (attemptId: string): string =>
  `puzzle:submit-lock:${attemptId}`;

// ─── Stats Hash Field Builders ────────────────────────────────────────────────

export const statsGlobalCorrectField = (): string => 'global:correct';
export const statsGlobalTotalField = (): string => 'global:total';

/** `sub:{subredditName}:correct` */
export const statsSubCorrectField = (subredditName: string): string =>
  `sub:${subredditName}:correct`;

/** `sub:{subredditName}:total` */
export const statsSubTotalField = (subredditName: string): string =>
  `sub:${subredditName}:total`;
