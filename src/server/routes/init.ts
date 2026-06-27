import { router, publicProcedure } from '../trpc';
import { deriveLaunchContext, normalizeSubredditName } from '../launchContext';
import { getProgress, getAllProgress } from '../redis/progressStore';
import { getStats, computeHiveIQ } from '../redis/statsStore';
import { getLeaderboardRank } from '../redis/leaderboardStore';
import { resolveSubredditMetadata } from '../reddit/resolveSubredditMetadata';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';
import type {
  InitResponse,
  SubredditDashboardCard,
  UserGlobalHiveIQMetrics,
  UserStatsProfile,
} from '../../shared/api';
import type { TRPCContext } from '../trpc';

const buildGlobalHiveIQ = (stats: UserStatsProfile): UserGlobalHiveIQMetrics => ({
  userGlobalHiveIQ: computeHiveIQ(stats.global.correctSlots, stats.global.totalSlots),
  totalCorrectSlots: stats.global.correctSlots,
  totalSlots: stats.global.totalSlots,
});

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
  ]
    .filter((name) => name.length > 0 && !curatedSet.has(name))
    .sort((a, b) => (progress[b] ?? 1) - (progress[a] ?? 1));

  const orderedSubreddits = [...curatedNames, ...customNames];

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

export const initRouter = router({
  init: publicProcedure.query(async ({ ctx }): Promise<InitResponse> => {
    const launchContext = deriveLaunchContext(ctx.subredditName, ctx.surface);
    const isHub = launchContext.surface === 'hub';
    const hostSubreddit = launchContext.hostSubreddit;

    if (ctx.userId === undefined) {
      return {
        hostSubreddit,
        isHub,
        activeSubreddit: isHub ? null : hostSubreddit,
        userGlobalHiveIQ: null,
        dashboardSubreddits: null,
        activeSubredditMetrics: null,
      };
    }

    const userId = ctx.userId;

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
        userGlobalHiveIQ: buildGlobalHiveIQ(stats),
        dashboardSubreddits,
        activeSubredditMetrics: null,
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

    return {
      hostSubreddit,
      isHub: false,
      activeSubreddit: hostSubreddit,
      userGlobalHiveIQ: buildGlobalHiveIQ(stats),
      dashboardSubreddits: null,
      activeSubredditMetrics: {
        userSubredditHiveIQ: computeHiveIQ(hostStats.correctSlots, hostStats.totalSlots),
        currentRankIndex,
      },
    };
  }),
});
