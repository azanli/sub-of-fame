import { router, publicProcedure } from '../trpc';
import { deriveLaunchContext, normalizeSubredditName } from '../launchContext';
import { getProgress, listProgressEntries } from '../redis/progressStore';
import {
  getStats,
  computeHiveIQ,
  ensureWelcomeCoins,
  getGameMode,
  getSubredditAggregate,
  getSubredditStreaks,
  getCampaignStats,
  subredditHasAnyStats,
} from '../redis/statsStore';
import { getLeaderboardRank } from '../redis/leaderboardStore';
import { upsertUsername } from '../redis/profileStore';
import { resolveSubredditMetadata } from '../reddit/resolveSubredditMetadata';
import { getDailyChallengeResetAt } from '../redis/dailyChallengeStore';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';
import { DAILY_CHALLENGE_SUBREDDIT, isDailyChallengeSubreddit } from '../../shared/dailyChallenge';
import {
  CAMPAIGN_TIMEFRAMES,
  DEFAULT_CAMPAIGN_TIMEFRAME,
  type CampaignContext,
} from '../../shared/campaignContext';
import {
  DEFAULT_GAME_MODE,
  type CampaignMetrics,
  type DailyChallengeMetrics,
  type InitResponse,
  type SubredditDashboardCard,
  type UserGlobalHiveIQMetrics,
  type UserStatsProfile,
} from '../../shared/api';
import type { TRPCContext } from '../trpc';

const buildGlobalHiveIQ = (stats: UserStatsProfile): UserGlobalHiveIQMetrics => ({
  userGlobalHiveIQ: computeHiveIQ(stats.global.correctSlots, stats.global.totalSlots),
  totalCorrectSlots: stats.global.correctSlots,
  totalSlots: stats.global.totalSlots,
});

const getCompletedRoundCount = (
  stats: UserStatsProfile,
  subreddit: string
): number =>
  Math.floor((getSubredditAggregate(stats, subreddit).totalSlots ?? 0) / 3);

const buildDashboardSubreddits = async (
  userId: string,
  progressEntries: Awaited<ReturnType<typeof listProgressEntries>>,
  stats: UserStatsProfile,
  reddit: TRPCContext['reddit']
): Promise<SubredditDashboardCard[]> => {
  const curatedNames = CURATED_SUBREDDITS.map((entry) => entry.name);
  const curatedSet = new Set(curatedNames);

  const progressSubreddits = new Set(
    progressEntries.map((entry) => entry.subredditName)
  );

  const customNames = [
    ...new Set([
      ...progressSubreddits,
      ...Object.keys(stats.bySubreddit).map(normalizeSubredditName),
    ]),
  ].filter(
    (name) => name.length > 0 && !curatedSet.has(name) && !isDailyChallengeSubreddit(name)
  );

  const orderedSubreddits = [...curatedNames, ...customNames].sort(
    (a, b) =>
      getCompletedRoundCount(stats, b) - getCompletedRoundCount(stats, a) ||
      a.localeCompare(b)
  );

  const cards = await Promise.all(
    orderedSubreddits.map(async (subreddit) => {
      const metadata = await resolveSubredditMetadata(subreddit, reddit);
      if (metadata === null) {
        return null;
      }

      const aggregateStats = getSubredditAggregate(stats, subreddit);
      const streaks = getSubredditStreaks(stats, subreddit);
      const allTimeCtx: CampaignContext = {
        subredditName: subreddit,
        timeframe: DEFAULT_CAMPAIGN_TIMEFRAME,
      };
      const allTimeProgress =
        progressEntries.find(
          (entry) =>
            entry.subredditName === subreddit && entry.timeframe === DEFAULT_CAMPAIGN_TIMEFRAME
        )?.rankIndex ?? 1;
      const leaderboardRank = await getLeaderboardRank(allTimeCtx, userId);

      return {
        ...metadata,
        currentRankIndex: allTimeProgress,
        userSubredditHiveIQ: computeHiveIQ(
          aggregateStats.correctSlots,
          aggregateStats.totalSlots
        ),
        completedRoundCount: Math.floor(aggregateStats.totalSlots / 3),
        leaderboardRank,
        currentStreak: streaks.currentStreak,
        highestStreak: streaks.highestStreak,
      };
    })
  );

  return cards.filter((card): card is SubredditDashboardCard => card !== null);
};

const resolvePlayerName = async (ctx: TRPCContext): Promise<string> => {
  if (ctx.userId === undefined) {
    return 'Guest';
  }

  const username = await ctx.reddit.getCurrentUsername();
  const playerName = username ?? 'Redditor';
  await upsertUsername(ctx.userId, playerName);
  return playerName;
};

const playerHasGameData = (
  stats: UserStatsProfile,
  progressEntries: Awaited<ReturnType<typeof listProgressEntries>>
): boolean =>
  stats.global.totalSlots > 0 ||
  progressEntries.some((entry) => entry.rankIndex > 1);

const buildDailyChallengeMetrics = (): DailyChallengeMetrics => ({
  subreddit: DAILY_CHALLENGE_SUBREDDIT,
  resetsAt: getDailyChallengeResetAt(),
});

const buildHostDashboardCard = async (
  hostSubreddit: string,
  reddit: TRPCContext['reddit'],
  options: {
    userId?: string;
    currentRankIndex?: number;
    hostStats?: { correctSlots: number; totalSlots: number };
    currentStreak?: number;
    highestStreak?: number;
  } = {}
): Promise<SubredditDashboardCard | null> => {
  const metadata = await resolveSubredditMetadata(hostSubreddit, reddit);
  if (metadata === null) {
    return null;
  }

  const currentRankIndex = options.currentRankIndex ?? 1;
  const hostStats = options.hostStats ?? { correctSlots: 0, totalSlots: 0 };
  const leaderboardRank =
    options.userId !== undefined
      ? await getLeaderboardRank(
          { subredditName: hostSubreddit, timeframe: DEFAULT_CAMPAIGN_TIMEFRAME },
          options.userId
        )
      : null;

  return {
    ...metadata,
    currentRankIndex,
    userSubredditHiveIQ: computeHiveIQ(hostStats.correctSlots, hostStats.totalSlots),
    completedRoundCount: Math.floor(hostStats.totalSlots / 3),
    leaderboardRank,
    currentStreak: options.currentStreak ?? 0,
    highestStreak: options.highestStreak ?? 0,
  };
};

const buildHostDashboardSubreddits = async (
  hostSubreddit: string,
  reddit: TRPCContext['reddit'],
  options: {
    userId?: string;
    currentRankIndex?: number;
    hostStats?: { correctSlots: number; totalSlots: number };
    currentStreak?: number;
    highestStreak?: number;
  } = {}
): Promise<SubredditDashboardCard[] | null> => {
  const card = await buildHostDashboardCard(hostSubreddit, reddit, options);
  return card !== null ? [card] : null;
};

const buildCampaignMetrics = async (
  hostSubreddit: string,
  userId: string,
  stats: UserStatsProfile,
  progressEntries: Awaited<ReturnType<typeof listProgressEntries>>
): Promise<CampaignMetrics[]> =>
  Promise.all(
    CAMPAIGN_TIMEFRAMES.map(async ({ id: timeframe }) => {
      const campaignCtx: CampaignContext = { subredditName: hostSubreddit, timeframe };
      const campaignStats = getCampaignStats(stats, campaignCtx);
      const currentRankIndex =
        progressEntries.find(
          (entry) => entry.subredditName === hostSubreddit && entry.timeframe === timeframe
        )?.rankIndex ?? 1;
      const leaderboardRank = await getLeaderboardRank(campaignCtx, userId);

      return {
        timeframe,
        currentRankIndex,
        userCampaignHiveIQ: computeHiveIQ(
          campaignStats.correctSlots,
          campaignStats.totalSlots
        ),
        completedRoundCount: Math.floor(campaignStats.totalSlots / 3),
        leaderboardRank,
      };
    })
  );

export const initRouter = router({
  init: publicProcedure.query(async ({ ctx }): Promise<InitResponse> => {
    const launchContext = deriveLaunchContext(ctx.subredditName, ctx.surface);
    const isHub = launchContext.surface === 'hub';
    const hostSubreddit = launchContext.hostSubreddit;
    const playerName = await resolvePlayerName(ctx);

    if (ctx.userId === undefined) {
      const dashboardSubreddits = isHub
        ? null
        : await buildHostDashboardSubreddits(hostSubreddit, ctx.reddit);

      return {
        hostSubreddit,
        isHub,
        activeSubreddit: isHub ? null : hostSubreddit,
        playerName,
        gameMode: DEFAULT_GAME_MODE,
        hasGameData: false,
        coins: null,
        userGlobalHiveIQ: null,
        dashboardSubreddits,
        activeSubredditMetrics: null,
        campaignMetrics: null,
        dailyChallenge: buildDailyChallengeMetrics(),
      };
    }

    const userId = ctx.userId;
    const [coins, gameMode] = await Promise.all([
      ensureWelcomeCoins(userId),
      getGameMode(userId),
    ]);

    if (isHub) {
      const [progressEntries, stats] = await Promise.all([
        listProgressEntries(userId),
        getStats(userId),
      ]);

      const dashboardSubreddits = await buildDashboardSubreddits(
        userId,
        progressEntries,
        stats,
        ctx.reddit
      );

      return {
        hostSubreddit,
        isHub: true,
        activeSubreddit: null,
        playerName,
        gameMode,
        hasGameData: playerHasGameData(stats, progressEntries),
        coins,
        userGlobalHiveIQ: buildGlobalHiveIQ(stats),
        dashboardSubreddits,
        activeSubredditMetrics: null,
        campaignMetrics: null,
        dailyChallenge: buildDailyChallengeMetrics(),
      };
    }

    const defaultCampaignCtx: CampaignContext = {
      subredditName: hostSubreddit,
      timeframe: DEFAULT_CAMPAIGN_TIMEFRAME,
    };

    const [currentRankIndex, stats, progressEntries] = await Promise.all([
      getProgress(userId, defaultCampaignCtx),
      getStats(userId),
      listProgressEntries(userId),
    ]);

    const hostAggregateStats = getSubredditAggregate(stats, hostSubreddit);
    const hostStreaks = getSubredditStreaks(stats, hostSubreddit);

    const [dashboardSubreddits, campaignMetrics] = await Promise.all([
      buildHostDashboardSubreddits(hostSubreddit, ctx.reddit, {
        userId,
        currentRankIndex,
        hostStats: hostAggregateStats,
        currentStreak: hostStreaks.currentStreak,
        highestStreak: hostStreaks.highestStreak,
      }),
      buildCampaignMetrics(hostSubreddit, userId, stats, progressEntries),
    ]);

    return {
      hostSubreddit,
      isHub: false,
      activeSubreddit: hostSubreddit,
      playerName,
      gameMode,
      hasGameData:
        playerHasGameData(stats, progressEntries) ||
        subredditHasAnyStats(stats, hostSubreddit),
      coins,
      userGlobalHiveIQ: buildGlobalHiveIQ(stats),
      dashboardSubreddits,
      activeSubredditMetrics: {
        userSubredditHiveIQ: computeHiveIQ(
          hostAggregateStats.correctSlots,
          hostAggregateStats.totalSlots
        ),
        currentRankIndex,
        activeTimeframe: DEFAULT_CAMPAIGN_TIMEFRAME,
      },
      campaignMetrics,
      dailyChallenge: buildDailyChallengeMetrics(),
    };
  }),
});
