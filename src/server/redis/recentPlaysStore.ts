import { redis } from '@devvit/web/server';
import { RECENT_PLAYS_TTL_S, recentPlaysKey } from './keys';

const WINDOW_MS = RECENT_PLAYS_TTL_S * 1000;

/**
 * Returns true when the user revealed this post within the recent-plays window.
 * Stale members (score older than the window) are treated as absent.
 */
export const hasRecentPlay = async (
  userId: string,
  sourcePostId: string,
  now: number = Date.now()
): Promise<boolean> => {
  const score = await redis.zScore(recentPlaysKey(userId), sourcePostId);
  if (score === undefined) {
    return false;
  }
  return score >= now - WINDOW_MS;
};

/**
 * Records a revealed post for anti-replay on volatile ladders.
 * Prunes members older than the window and refreshes the key TTL.
 */
export const recordRecentPlay = async (
  userId: string,
  sourcePostId: string,
  now: number = Date.now()
): Promise<void> => {
  const key = recentPlaysKey(userId);
  const cutoff = now - WINDOW_MS;

  await redis.zAdd(key, { score: now, member: sourcePostId });
  // Inclusive max: remove scores strictly older than the window.
  if (cutoff > 0) {
    await redis.zRemRangeByScore(key, 0, cutoff - 1);
  }
  await redis.expire(key, RECENT_PLAYS_TTL_S);
};
