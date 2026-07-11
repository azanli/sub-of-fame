import type { CampaignContext } from '../../shared/campaignContext';
import type { CampaignTimeframe } from '../../shared/campaignTimeframes';
import { isDailyChallengeSubreddit } from '../../shared/dailyChallenge';
import {
  DAILY_LADDER_PAGE_TTL_S,
  LADDER_PAGE_TTL_S,
  STANDARD_LADDER_PAGE_SIZE,
  DAILY_LADDER_PAGE_SIZE,
} from './keys';

// ─── TTL constants by campaign timeframe volatility ───────────────────────────

export const NOW_LADDER_PAGE_TTL_S = 10 * 60; // 10 minutes
export const DAY_LADDER_PAGE_TTL_S = 2 * 60 * 60; // 2 hours
export const WEEK_LADDER_PAGE_TTL_S = 8 * 60 * 60; // 8 hours
export const MONTH_YEAR_LADDER_PAGE_TTL_S = 24 * 60 * 60; // 24 hours

const TIMEFRAME_PAGE_TTL_S: Record<CampaignTimeframe, number> = {
  now: NOW_LADDER_PAGE_TTL_S,
  day: DAY_LADDER_PAGE_TTL_S,
  week: WEEK_LADDER_PAGE_TTL_S,
  month: MONTH_YEAR_LADDER_PAGE_TTL_S,
  year: MONTH_YEAR_LADDER_PAGE_TTL_S,
  all: LADDER_PAGE_TTL_S,
};

// ─── Progress hash field ──────────────────────────────────────────────────────

/** Hash field on `user:{userId}:progress`: `{subredditName}:{timeframe}` */
export const progressField = (ctx: CampaignContext): string =>
  `${ctx.subredditName}:${ctx.timeframe}`;

/**
 * Parse a progress hash field into campaign scope.
 * Legacy fields without a timeframe segment map to `DEFAULT_CAMPAIGN_TIMEFRAME` (`all`).
 */
export const parseProgressField = (
  field: string
): { subredditName: string; timeframe: CampaignTimeframe } | null => {
  const separatorIndex = field.lastIndexOf(':');
  if (separatorIndex === -1) {
    return { subredditName: field, timeframe: 'all' };
  }

  const subredditName = field.slice(0, separatorIndex);
  const timeframe = field.slice(separatorIndex + 1) as CampaignTimeframe;
  const validTimeframes: CampaignTimeframe[] = [
    'all',
    'year',
    'month',
    'week',
    'day',
    'now',
  ];

  if (subredditName.length === 0 || !validTimeframes.includes(timeframe)) {
    return null;
  }

  return { subredditName, timeframe };
};

// ─── Leaderboard ────────────────────────────────────────────────────────────────

/** `leaderboard:{subredditName}:{timeframe}` */
export const campaignLeaderboardKey = (ctx: CampaignContext): string =>
  `leaderboard:${ctx.subredditName}:${ctx.timeframe}`;

/** Legacy key before timeframe dimension: `leaderboard:{subredditName}` */
export const legacyLeaderboardKey = (subredditName: string): string =>
  `leaderboard:${subredditName}`;

/** Ecosystem-wide sum of per-subreddit bestClearedRankIndex scores. */
export const ecosystemLeaderboardKey = (): string => 'leaderboard:ecosystem';

// ─── Ladder cache ───────────────────────────────────────────────────────────────

/** `sub:ladder:{subredditName}:{timeframe}:{page}` */
export const campaignLadderPageKey = (ctx: CampaignContext, page: number): string =>
  `sub:ladder:${ctx.subredditName}:${ctx.timeframe}:${page}`;

/** `sub:ladder:{subredditName}:{timeframe}:cursors` */
export const campaignLadderCursorsKey = (ctx: CampaignContext): string =>
  `sub:ladder:${ctx.subredditName}:${ctx.timeframe}:cursors`;

// ─── Stats hash fields ──────────────────────────────────────────────────────────

/** Per-campaign: `sub:{subredditName}:{timeframe}:correct` */
export const statsCampaignCorrectField = (ctx: CampaignContext): string =>
  `sub:${ctx.subredditName}:${ctx.timeframe}:correct`;

/** Per-campaign: `sub:{subredditName}:{timeframe}:total` */
export const statsCampaignTotalField = (ctx: CampaignContext): string =>
  `sub:${ctx.subredditName}:${ctx.timeframe}:total`;

/** Subreddit rollup: `sub:{subredditName}:correct` */
export const statsSubredditCorrectField = (subredditName: string): string =>
  `sub:${subredditName}:correct`;

/** Subreddit rollup: `sub:{subredditName}:total` */
export const statsSubredditTotalField = (subredditName: string): string =>
  `sub:${subredditName}:total`;

/** Subreddit streak: `sub:{subredditName}:streak:current` */
export const statsSubredditCurrentStreakField = (subredditName: string): string =>
  `sub:${subredditName}:streak:current`;

/** Subreddit streak: `sub:{subredditName}:streak:highest` */
export const statsSubredditHighestStreakField = (subredditName: string): string =>
  `sub:${subredditName}:streak:highest`;

// ─── Ladder pipeline policy resolvers ───────────────────────────────────────────

/** Ladder page TTL by campaign timeframe; Daily Challenge subreddit keeps its own TTL. */
export const resolveCampaignLadderPageTtlS = (ctx: CampaignContext): number => {
  if (isDailyChallengeSubreddit(ctx.subredditName)) {
    return DAILY_LADDER_PAGE_TTL_S;
  }
  return TIMEFRAME_PAGE_TTL_S[ctx.timeframe];
};

/** Ladder page size: 50 for Daily Challenge, 100 otherwise. */
export const resolveCampaignLadderPageSize = (ctx: CampaignContext): number =>
  isDailyChallengeSubreddit(ctx.subredditName)
    ? DAILY_LADDER_PAGE_SIZE
    : STANDARD_LADDER_PAGE_SIZE;

export type RedditTopTimeframe = 'all' | 'year' | 'month' | 'week' | 'day';

export type RedditListingStrategy =
  | { kind: 'top'; timeframe: RedditTopTimeframe }
  | { kind: 'hot' };

/** Maps campaign timeframe to the Reddit listing API strategy. */
export const resolveRedditListingStrategy = (
  ctx: CampaignContext
): RedditListingStrategy => {
  if (isDailyChallengeSubreddit(ctx.subredditName)) {
    return { kind: 'top', timeframe: 'day' };
  }

  if (ctx.timeframe === 'now') {
    return { kind: 'hot' };
  }

  return { kind: 'top', timeframe: ctx.timeframe };
};
