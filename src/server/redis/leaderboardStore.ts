import { redis } from '@devvit/web/server';
import type { LeaderboardEntry } from '../../shared/api';
import { leaderboardKey, statsKey, statsSubCorrectField, statsSubTotalField } from './keys';
import { computeHiveIQ } from './statsStore';

/**
 * Update the leaderboard with a player's cleared rank using monotonic GT semantics.
 * The Devvit Redis client's zAdd does not expose the ZADD GT flag directly, so
 * monotonicity is enforced with a read-check-write: read the current score first,
 * and only call zAdd when the new rank is strictly greater (further in the ladder).
 *
 * A small race window exists when two submits for the same user complete simultaneously
 * in different serverless invocations. The submit-lock guarantees only one submit per
 * attempt succeeds, so the race can only occur across distinct attempts at different
 * ranks. In that case the last writer wins, which is still a valid cleared rank for
 * the user. For MVP this is an acceptable tradeoff.
 *
 * Call only after a successful user-owned submit — never for invalid-post skips.
 */
export const updateLeaderboard = async (
  subredditName: string,
  userId: string,
  clearedRankIndex: number
): Promise<void> => {
  const key = leaderboardKey(subredditName);
  const currentScore = await redis.zScore(key, userId);
  if (currentScore !== undefined && currentScore >= clearedRankIndex) return;
  await redis.zAdd(key, { score: clearedRankIndex, member: userId });
};

/**
 * Return the 1-based display rank for a user on a subreddit leaderboard.
 * Returns null when the user is not on the leaderboard.
 *
 * Display rank = 1 + (number of members with a strictly higher score).
 * Tied users receive the same display rank (ties are resolved by Hive IQ at display time).
 * Because scores are integer rankIndexes, "strictly higher" means score >= (userScore + 1).
 */
export const getLeaderboardRank = async (
  subredditName: string,
  userId: string
): Promise<number | null> => {
  const key = leaderboardKey(subredditName);
  const userScore = await redis.zScore(key, userId);
  if (userScore === undefined) return null;

  // Count members with score strictly higher than this user's score.
  // zRange with by:'score' and start/stop as numbers returns members in that score range.
  const higher = await redis.zRange(key, userScore + 1, '+inf', { by: 'score' });
  return higher.length + 1;
};

/**
 * Return a page of leaderboard entries in descending score order (best cleared rank first).
 * offset is 0-based; entries have Hive IQ hydrated from individual stats hashes.
 * Tied users share the same displayRank.
 */
export const getLeaderboardPage = async (
  subredditName: string,
  offset: number,
  count: number
): Promise<LeaderboardEntry[]> => {
  const key = leaderboardKey(subredditName);

  // zRange with reverse:true and by:'rank' returns members from highest to lowest score.
  const members = await redis.zRange(key, offset, offset + count - 1, {
    by: 'rank',
    reverse: true,
  });

  if (members.length === 0) return [];

  const entries: LeaderboardEntry[] = [];
  let displayRank = offset + 1;
  let prevScore: number | null = null;
  let tieDisplayRank = displayRank;

  for (const member of members) {
    const userId = member.member;
    const bestClearedRankIndex = member.score;

    const statsFields = await redis.hGetAll(statsKey(userId));
    const correctRaw = statsFields[statsSubCorrectField(subredditName)];
    const totalRaw = statsFields[statsSubTotalField(subredditName)];
    const correct = correctRaw !== undefined ? parseInt(correctRaw, 10) : 0;
    const total = totalRaw !== undefined ? parseInt(totalRaw, 10) : 0;
    const hiveIQ = computeHiveIQ(correct, total) ?? 0;

    if (prevScore !== null && bestClearedRankIndex === prevScore) {
      entries.push({ userId, bestClearedRankIndex, userSubredditHiveIQ: hiveIQ, displayRank: tieDisplayRank });
    } else {
      tieDisplayRank = displayRank;
      entries.push({ userId, bestClearedRankIndex, userSubredditHiveIQ: hiveIQ, displayRank });
    }

    prevScore = bestClearedRankIndex;
    displayRank++;
  }

  return entries;
};
