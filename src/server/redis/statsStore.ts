import { redis } from '@devvit/web/server';
import type { CampaignContext } from '../../shared/campaignContext';
import type { CampaignTimeframe } from '../../shared/campaignTimeframes';
import type {
  GameMode,
  PerformanceCounters,
  RoundStatsDelta,
  SubredditStatsProfile,
  UserStatsProfile,
} from '../../shared/api';
import { DEFAULT_GAME_MODE } from '../../shared/api';
import { computeHiveIQScore } from '../../shared/hiveIQ';
import {
  statsCampaignCorrectField,
  statsCampaignTotalField,
  statsSubredditCorrectField,
  statsSubredditTotalField,
} from './campaignKeys';
import {
  statsKey,
  statsCoinsField,
  statsGameModeField,
  statsGlobalCorrectField,
  statsGlobalTotalField,
} from './keys';

/** Welcome balance granted once when a user has no coins field yet. */
export const WELCOME_COINS = 3;

const EMPTY_COUNTERS: PerformanceCounters = { correctSlots: 0, totalSlots: 0 };

const parseStoredGameMode = (raw: string | undefined): GameMode => {
  if (raw === 'casual' || raw === 'expert') {
    return raw;
  }
  return DEFAULT_GAME_MODE;
};

export const getGameMode = async (userId: string): Promise<GameMode> => {
  const raw = await redis.hGet(statsKey(userId), statsGameModeField());
  return parseStoredGameMode(raw);
};

export const setGameMode = async (
  userId: string,
  gameMode: GameMode
): Promise<GameMode> => {
  await redis.hSet(statsKey(userId), { [statsGameModeField()]: gameMode });
  return gameMode;
};

export const computeHiveIQ = (
  correctSlots: number,
  totalSlots: number
): number | null => computeHiveIQScore(correctSlots, totalSlots);

export const ensureWelcomeCoins = async (userId: string): Promise<number> => {
  const key = statsKey(userId);
  const field = statsCoinsField();
  const raw = await redis.hGet(key, field);
  if (raw !== undefined) {
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  await redis.hSet(key, { [field]: String(WELCOME_COINS) });
  return WELCOME_COINS;
};

export const incrementStats = async (
  userId: string,
  ctx: CampaignContext,
  delta: RoundStatsDelta
): Promise<number> => {
  const key = statsKey(userId);
  const [, , , , , , coins] = await Promise.all([
    redis.hIncrBy(key, statsGlobalCorrectField(), delta.correctSlots),
    redis.hIncrBy(key, statsGlobalTotalField(), 3),
    redis.hIncrBy(key, statsCampaignCorrectField(ctx), delta.correctSlots),
    redis.hIncrBy(key, statsCampaignTotalField(ctx), 3),
    redis.hIncrBy(key, statsSubredditCorrectField(ctx.subredditName), delta.correctSlots),
    redis.hIncrBy(key, statsSubredditTotalField(ctx.subredditName), 3),
    redis.hIncrBy(key, statsCoinsField(), delta.coinAward),
  ]);

  return coins;
};

export const deductCoins = async (
  userId: string,
  amount: number
): Promise<{ ok: true; coins: number } | { ok: false }> => {
  if (amount <= 0) {
    const stats = await getStats(userId);
    return { ok: true, coins: stats.coins };
  }

  const key = statsKey(userId);
  const field = statsCoinsField();
  const newBalance = await redis.hIncrBy(key, field, -amount);
  if (newBalance < 0) {
    await redis.hIncrBy(key, field, amount);
    return { ok: false };
  }
  return { ok: true, coins: newBalance };
};

export const deductCoin = async (
  userId: string
): Promise<{ ok: true; coins: number } | { ok: false }> => deductCoins(userId, 1);

const VALID_TIMEFRAMES: CampaignTimeframe[] = [
  'all',
  'year',
  'month',
  'week',
  'day',
  'now',
];

const parseStatsField = (
  field: string
): { subreddit: string; kind: 'aggregate' | 'campaign'; timeframe?: CampaignTimeframe; counter: 'correct' | 'total' } | null => {
  const aggregateMatch = /^sub:(.+):(correct|total)$/.exec(field);
  if (aggregateMatch) {
    const [, subreddit, counterKind] = aggregateMatch;
    if (subreddit === undefined || counterKind === undefined) return null;

    const timeframeParts = subreddit.split(':');
    if (timeframeParts.length === 2) {
      const [subName, timeframeRaw] = timeframeParts;
      if (
        subName !== undefined &&
        timeframeRaw !== undefined &&
        VALID_TIMEFRAMES.includes(timeframeRaw as CampaignTimeframe) &&
        (counterKind === 'correct' || counterKind === 'total')
      ) {
        return {
          subreddit: subName,
          kind: 'campaign',
          timeframe: timeframeRaw as CampaignTimeframe,
          counter: counterKind,
        };
      }
    }

    if (counterKind === 'correct' || counterKind === 'total') {
      return { subreddit, kind: 'aggregate', counter: counterKind };
    }
  }

  return null;
};

export const getStats = async (userId: string): Promise<UserStatsProfile> => {
  const fields = await redis.hGetAll(statsKey(userId));

  const parseFieldValue = (field: string): number => {
    const v = fields[field];
    if (v === undefined) return 0;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const bySubreddit: Record<string, SubredditStatsProfile> = {};

  const ensureSubreddit = (subreddit: string): SubredditStatsProfile => {
    if (!bySubreddit[subreddit]) {
      bySubreddit[subreddit] = {
        aggregate: { ...EMPTY_COUNTERS },
        byTimeframe: {},
      };
    }
    return bySubreddit[subreddit]!;
  };

  for (const [field, value] of Object.entries(fields)) {
    const parsed = parseStatsField(field);
    if (parsed === null) continue;

    const amount = parseInt(value, 10);
    const normalized = Number.isFinite(amount) ? amount : 0;
    const profile = ensureSubreddit(parsed.subreddit);

    if (parsed.kind === 'aggregate') {
      if (parsed.counter === 'correct') {
        profile.aggregate.correctSlots = normalized;
      } else {
        profile.aggregate.totalSlots = normalized;
      }
      continue;
    }

    if (parsed.timeframe === undefined) continue;
    if (!profile.byTimeframe[parsed.timeframe]) {
      profile.byTimeframe[parsed.timeframe] = { ...EMPTY_COUNTERS };
    }
    const timeframeStats = profile.byTimeframe[parsed.timeframe]!;
    if (parsed.counter === 'correct') {
      timeframeStats.correctSlots = normalized;
    } else {
      timeframeStats.totalSlots = normalized;
    }
  }

  return {
    global: {
      correctSlots: parseFieldValue(statsGlobalCorrectField()),
      totalSlots: parseFieldValue(statsGlobalTotalField()),
    },
    bySubreddit,
    coins: parseFieldValue(statsCoinsField()),
  };
};

export const getSubredditAggregate = (
  stats: UserStatsProfile,
  subredditName: string
): PerformanceCounters =>
  stats.bySubreddit[subredditName]?.aggregate ?? EMPTY_COUNTERS;

export const getCampaignStats = (
  stats: UserStatsProfile,
  ctx: CampaignContext
): PerformanceCounters =>
  stats.bySubreddit[ctx.subredditName]?.byTimeframe[ctx.timeframe] ?? EMPTY_COUNTERS;

export const subredditHasAnyStats = (
  stats: UserStatsProfile,
  subredditName: string
): boolean => {
  const profile = stats.bySubreddit[subredditName];
  if (profile === undefined) return false;
  if (profile.aggregate.totalSlots > 0) return true;
  return Object.values(profile.byTimeframe).some((entry) => (entry?.totalSlots ?? 0) > 0);
};

export const listSubredditsWithStats = (stats: UserStatsProfile): string[] =>
  Object.entries(stats.bySubreddit)
    .filter(([, profile]) => {
      if (profile.aggregate.totalSlots > 0) return true;
      return Object.values(profile.byTimeframe).some((entry) => (entry?.totalSlots ?? 0) > 0);
    })
    .map(([subreddit]) => subreddit);
