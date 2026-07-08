import { redis } from '@devvit/web/server';
import { CAMPAIGN_TIMEFRAME_IDS } from '../../shared/campaignContext';
import {
  campaignLeaderboardKey,
  ecosystemLeaderboardKey,
  legacyLeaderboardKey,
} from './campaignKeys';
import { currentUtcDateStamp } from './dailyChallengeStore';
import { dailyProgressKey, progressKey, statsKey } from './keys';
import { listProgressEntries } from './progressStore';
import { getStats } from './statsStore';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const profileKey = (userId: string): string => `user:${userId}:profile`;

/** UTC date stamps for today and the previous two days (covers the 2-day daily-progress TTL). */
const recentDailyProgressDateStamps = (now: number = Date.now()): string[] => {
  const stamps: string[] = [];
  for (let daysAgo = 0; daysAgo < 3; daysAgo += 1) {
    stamps.push(currentUtcDateStamp(now - daysAgo * MS_PER_DAY));
  }
  return stamps;
};

/**
 * Permanently removes all durable player data for a user from Redis.
 *
 * Devvit Redis cannot glob-scan keys, so daily-progress hashes older than the
 * TTL window cannot be discovered if their names were lost. Recent date stamps
 * are deleted explicitly; older keys auto-expire.
 */
export const deleteAllUserData = async (userId: string): Promise<void> => {
  const [progressEntries, stats] = await Promise.all([
    listProgressEntries(userId),
    getStats(userId),
  ]);

  const subreddits = new Set<string>([
    ...progressEntries.map((entry) => entry.subredditName),
    ...Object.keys(stats.bySubreddit),
  ]);

  const leaderboardRemovals = [
    redis.zRem(ecosystemLeaderboardKey(), [userId]),
    ...[...subreddits].flatMap((subreddit) => [
      redis.zRem(legacyLeaderboardKey(subreddit), [userId]),
      ...CAMPAIGN_TIMEFRAME_IDS.map((timeframe) =>
        redis.zRem(campaignLeaderboardKey({ subredditName: subreddit, timeframe }), [
          userId,
        ])
      ),
    ]),
  ];

  const userKeyDeletions = [
    redis.del(progressKey(userId)),
    redis.del(statsKey(userId)),
    redis.del(profileKey(userId)),
    ...recentDailyProgressDateStamps().map((dateStamp) =>
      redis.del(dailyProgressKey(userId, dateStamp))
    ),
  ];

  await Promise.all([...leaderboardRemovals, ...userKeyDeletions]);
};
