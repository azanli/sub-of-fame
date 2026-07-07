import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { deriveLaunchContext, normalizeSubredditName } from '../launchContext';
import { listProgressEntries } from '../redis/progressStore';
import {
  computeHiveIQ,
  getStats,
  getSubredditAggregate,
} from '../redis/statsStore';
import {
  getEcosystemLeaderboardPage,
  getEcosystemLeaderboardRank,
  getLeaderboardPage,
  getLeaderboardRank,
} from '../redis/leaderboardStore';
import { resolveSubredditMetadata } from '../reddit/resolveSubredditMetadata';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';
import { isDailyChallengeSubreddit } from '../../shared/dailyChallenge';
import {
  DEFAULT_CAMPAIGN_TIMEFRAME,
  type CampaignContext,
} from '../../shared/campaignContext';
import type {
  LeaderboardEntry,
  LeaderboardPageResponse,
  LeaderboardRow,
  LeaderboardSection,
  SubredditDashboardCard,
} from '../../shared/api';
import { resolveHiveIQDisplay } from '../../shared/hiveIQ';
import type { TRPCContext } from '../trpc';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

const toLeaderboardRow = (entry: LeaderboardEntry): LeaderboardRow => ({
  displayRank: entry.displayRank,
  username: entry.username,
  hiveIQDisplay: resolveHiveIQDisplay(
    entry.userSubredditHiveIQ,
    entry.completedRoundCount
  ),
  isCurrentUser: entry.isCurrentUser,
});

const buildActiveSubredditCards = async (
  userId: string,
  reddit: TRPCContext['reddit']
): Promise<SubredditDashboardCard[]> => {
  const [progressEntries, stats] = await Promise.all([
    listProgressEntries(userId),
    getStats(userId),
  ]);

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

  const candidateSubreddits = [...curatedNames, ...customNames];

  const cards = await Promise.all(
    candidateSubreddits.map(async (subreddit) => {
      const metadata = await resolveSubredditMetadata(subreddit, reddit);
      if (metadata === null) {
        return null;
      }

      const aggregateStats = getSubredditAggregate(stats, subreddit);
      const allTimeCtx: CampaignContext = {
        subredditName: subreddit,
        timeframe: DEFAULT_CAMPAIGN_TIMEFRAME,
      };
      const currentRankIndex =
        progressEntries.find(
          (entry) =>
            entry.subredditName === subreddit && entry.timeframe === DEFAULT_CAMPAIGN_TIMEFRAME
        )?.rankIndex ?? 1;
      const completedRoundCount = Math.floor(aggregateStats.totalSlots / 3);
      const isActive = completedRoundCount > 0 || currentRankIndex > 1;

      if (!isActive) {
        return null;
      }

      const leaderboardRank = await getLeaderboardRank(allTimeCtx, userId);

      return {
        ...metadata,
        currentRankIndex,
        userSubredditHiveIQ: computeHiveIQ(
          aggregateStats.correctSlots,
          aggregateStats.totalSlots
        ),
        completedRoundCount,
        leaderboardRank,
      };
    })
  );

  return cards.filter((card): card is SubredditDashboardCard => card !== null);
};

const buildSubredditSection = async (
  subredditName: string,
  title: string,
  limit: number,
  userId: string | undefined,
  reddit: TRPCContext['reddit']
): Promise<LeaderboardSection | null> => {
  const metadata = await resolveSubredditMetadata(subredditName, reddit);
  if (metadata === null) {
    return null;
  }

  const ctx: CampaignContext = {
    subredditName,
    timeframe: DEFAULT_CAMPAIGN_TIMEFRAME,
  };

  const [entries, viewerRank] = await Promise.all([
    getLeaderboardPage(ctx, 0, limit, userId),
    userId !== undefined ? getLeaderboardRank(ctx, userId) : Promise.resolve(null),
  ]);

  return {
    scope: { kind: 'subreddit', subredditName },
    title,
    subredditMetadata: metadata,
    entries: entries.map(toLeaderboardRow),
    viewerRank,
  };
};

export const leaderboardRouter = router({
  getPage: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(MAX_LIMIT).optional() }))
    .query(async ({ input, ctx }): Promise<LeaderboardPageResponse> => {
      const launchContext = deriveLaunchContext(ctx.subredditName, ctx.surface);
      const isHub = launchContext.surface === 'hub';
      const limit = input.limit ?? DEFAULT_LIMIT;
      const userId = ctx.userId;

      if (isHub) {
        const [ecosystemEntries, ecosystemViewerRank] = await Promise.all([
          getEcosystemLeaderboardPage(0, limit, userId),
          userId !== undefined
            ? getEcosystemLeaderboardRank(userId)
            : Promise.resolve(null),
        ]);

        const sections: LeaderboardSection[] = [
          {
            scope: { kind: 'ecosystem' },
            title: 'Global Leaderboard',
            subredditMetadata: null,
            entries: ecosystemEntries.map(toLeaderboardRow),
            viewerRank: ecosystemViewerRank,
          },
        ];

        if (userId !== undefined) {
          const activeCards = await buildActiveSubredditCards(userId, ctx.reddit);
          const subredditSections = await Promise.all(
            activeCards.map((card) =>
              buildSubredditSection(
                card.subreddit,
                card.displayName,
                limit,
                userId,
                ctx.reddit
              )
            )
          );

          for (const section of subredditSections) {
            if (section !== null) {
              sections.push(section);
            }
          }
        }

        return { isHub: true, sections };
      }

      const hostSubreddit = launchContext.hostSubreddit;
      const hostSection = await buildSubredditSection(
        hostSubreddit,
        'Leaderboard',
        limit,
        userId,
        ctx.reddit
      );

      return {
        isHub: false,
        sections: hostSection !== null ? [hostSection] : [],
      };
    }),
});
