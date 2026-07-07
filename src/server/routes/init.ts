import { router, publicProcedure } from '../trpc';
import { deriveLaunchContext, normalizeSubredditName } from '../launchContext';
import { getProgress, getAllProgress } from '../redis/progressStore';
import { getStats, computeHiveIQ, ensureWelcomeCoins, getGameMode } from '../redis/statsStore';
import { getLeaderboardRank } from '../redis/leaderboardStore';
import { resolveSubredditMetadata } from '../reddit/resolveSubredditMetadata';
import { getDailyChallengeResetAt } from '../redis/dailyChallengeStore';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';
import { DAILY_CHALLENGE_SUBREDDIT, isDailyChallengeSubreddit } from '../../shared/dailyChallenge';
import {
  DEFAULT_GAME_MODE,
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
): number => Math.floor((stats.bySubreddit[subreddit]?.totalSlots ?? 0) / 3);

const buildDashboardSubreddits = async (
  userId: string,
  progress: Record<string, number>,
  stats: UserStatsProfile,
  reddit: TRPCContext['reddit']
): Promise<SubredditDashboardCard[]> => {
  const curatedNames = CURATED_SUBREDDITS.map((entry) => entry.name);
  const curatedSet = new Set(curatedNames);

  const customNames = [
    ...new Set(
      [...Object.keys(progress), ...Object.keys(stats.bySubreddit)].map(normalizeSubredditName)
    ),
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

      const subStats = stats.bySubreddit[subreddit] ?? {
        correctSlots: 0,
        totalSlots: 0,
      };
      const leaderboardRank = await getLeaderboardRank(subreddit, userId);

      return {
        ...metadata,
        currentRankIndex: progress[subreddit] ?? 1,
        userSubredditHiveIQ: computeHiveIQ(subStats.correctSlots, subStats.totalSlots),
        completedRoundCount: Math.floor(subStats.totalSlots / 3),
        leaderboardRank,
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
  return username ?? 'Redditor';
};

const playerHasGameData = (
  stats: UserStatsProfile,
  progress: Record<string, number>
): boolean =>
  stats.global.totalSlots > 0 ||
  Object.values(progress).some((rankIndex) => rankIndex > 1);

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
      ? await getLeaderboardRank(hostSubreddit, options.userId)
      : null;

  return {
    ...metadata,
    currentRankIndex,
    userSubredditHiveIQ: computeHiveIQ(hostStats.correctSlots, hostStats.totalSlots),
    completedRoundCount: Math.floor(hostStats.totalSlots / 3),
    leaderboardRank,
  };
};

const buildHostDashboardSubreddits = async (
  hostSubreddit: string,
  reddit: TRPCContext['reddit'],
  options: {
    userId?: string;
    currentRankIndex?: number;
    hostStats?: { correctSlots: number; totalSlots: number };
  } = {}
): Promise<SubredditDashboardCard[] | null> => {
  const card = await buildHostDashboardCard(hostSubreddit, reddit, options);
  return card !== null ? [card] : null;
};

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
        dailyChallenge: isHub ? buildDailyChallengeMetrics() : null,
      };
    }

    const userId = ctx.userId;
    const [coins, gameMode] = await Promise.all([
      ensureWelcomeCoins(userId),
      getGameMode(userId),
    ]);

    if (isHub) {
      const [progress, stats] = await Promise.all([
        getAllProgress(userId),
        getStats(userId),
      ]);

      const dashboardSubreddits = await buildDashboardSubreddits(
        userId,
        progress,
        stats,
        ctx.reddit
      );

      return {
        hostSubreddit,
        isHub: true,
        activeSubreddit: null,
        playerName,
        gameMode,
        hasGameData: playerHasGameData(stats, progress),
        coins,
        userGlobalHiveIQ: buildGlobalHiveIQ(stats),
        dashboardSubreddits,
        activeSubredditMetrics: null,
        dailyChallenge: buildDailyChallengeMetrics(),
      };
    }

    const [currentRankIndex, stats] = await Promise.all([
      getProgress(userId, hostSubreddit),
      getStats(userId),
    ]);

    const hostStats = stats.bySubreddit[hostSubreddit] ?? {
      correctSlots: 0,
      totalSlots: 0,
    };

    const dashboardSubreddits = await buildHostDashboardSubreddits(
      hostSubreddit,
      ctx.reddit,
      {
        userId,
        currentRankIndex,
        hostStats,
      }
    );

    return {
      hostSubreddit,
      isHub: false,
      activeSubreddit: hostSubreddit,
      playerName,
      gameMode,
      hasGameData: playerHasGameData(stats, { [hostSubreddit]: currentRankIndex }),
      coins,
      userGlobalHiveIQ: buildGlobalHiveIQ(stats),
      dashboardSubreddits,
      activeSubredditMetrics: {
        userSubredditHiveIQ: computeHiveIQ(hostStats.correctSlots, hostStats.totalSlots),
        currentRankIndex,
      },
      dailyChallenge: null,
    };
  }),
});
