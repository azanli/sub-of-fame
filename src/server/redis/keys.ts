// Pure key and field builder functions. No Redis import — callers pass results
// to the appropriate Redis client methods. Subreddit segments are expected to be
// pre-normalized (lowercase, stripped of r/ prefix) by the caller.

import { isDailyChallengeSubreddit } from '../../shared/dailyChallenge';

// ─── TTL Constants (seconds) ──────────────────────────────────────────────────

export const METADATA_TTL_S = 7 * 24 * 60 * 60; // 7 days
export const LADDER_PAGE_TTL_S = 7 * 24 * 60 * 60; // 7 days
export const LADDER_CURSORS_TTL_S = 30 * 24 * 60 * 60; // 30 days
export const SNAPSHOT_TTL_S = 7 * 24 * 60 * 60; // 7 days
export const ATTEMPT_TTL_S = 60 * 60; // 1 hour
export const SUBMIT_LOCK_TTL_S = 60 * 60; // 1 hour

/**
 * The r/all feed moves far faster than a curated/custom subreddit's top-of-all-time
 * ladder, so its cached pages must expire much sooner than LADDER_PAGE_TTL_S.
 */
export const DAILY_LADDER_PAGE_TTL_S = 2 * 60 * 60; // 2 hours

/** Cleanup-only TTL for the daily progress hash; the key itself rotates at the UTC reset boundary. */
export const DAILY_PROGRESS_TTL_S = 2 * 24 * 60 * 60; // 2 days

// ─── Ladder Pipeline Policy Resolvers ─────────────────────────────────────────

export const STANDARD_LADDER_PAGE_SIZE = 100;
export const DAILY_LADDER_PAGE_SIZE = 50;

/** Ladder page TTL: aggressive for the r/all Daily Challenge, durable otherwise. */
export const resolveLadderPageTtlS = (subredditName: string): number =>
  isDailyChallengeSubreddit(subredditName) ? DAILY_LADDER_PAGE_TTL_S : LADDER_PAGE_TTL_S;

/** Ladder page size: 50 posts/page for the Daily Challenge per spec, 100 otherwise. */
export const resolveLadderPageSize = (subredditName: string): number =>
  isDailyChallengeSubreddit(subredditName) ? DAILY_LADDER_PAGE_SIZE : STANDARD_LADDER_PAGE_SIZE;

/** getTopPosts timeframe: last 24h for the Daily Challenge, all-time otherwise. */
export const resolveLadderTimeframe = (subredditName: string): 'day' | 'all' =>
  isDailyChallengeSubreddit(subredditName) ? 'day' : 'all';

// ─── Key Builders ─────────────────────────────────────────────────────────────

/** `user:{userId}:progress` — hash of subredditName → rankIndex (integer string) */
export const progressKey = (userId: string): string => `user:${userId}:progress`;

/**
 * `user:{userId}:daily-progress:{dateStamp}` — hash of subredditName → rankIndex for the
 * Daily Challenge gauntlet, isolated from the persistent `progressKey` hash. The dateStamp
 * segment (UTC "YYYY-MM-DD") rotates at the reset boundary, so a new day automatically
 * starts from a fresh, empty hash with no explicit reset logic required.
 */
export const dailyProgressKey = (userId: string, dateStamp: string): string =>
  `user:${userId}:daily-progress:${dateStamp}`;

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

/** `coins` — Karma Coin wallet balance (integer string) */
export const statsCoinsField = (): string => 'coins';

/** `gameMode` — player gameplay mode preference (`casual` | `expert`) */
export const statsGameModeField = (): string => 'gameMode';
