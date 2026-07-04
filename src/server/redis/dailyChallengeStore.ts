import { redis } from '@devvit/web/server';
import { DAILY_CHALLENGE_SUBREDDIT } from '../../shared/dailyChallenge';
import { dailyProgressKey, DAILY_PROGRESS_TTL_S } from './keys';

const PROGRESS_DEFAULT = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * UTC "YYYY-MM-DD" stamp for `now`. Used as a key segment so the daily progress hash
 * rotates automatically at the reset boundary — no explicit reset job required.
 */
export const currentUtcDateStamp = (now: number = Date.now()): string =>
  new Date(now).toISOString().slice(0, 10);

/** Epoch ms of the next UTC-midnight reset boundary, strictly after `now`. */
export const getDailyChallengeResetAt = (now: number = Date.now()): number =>
  Math.floor(now / MS_PER_DAY) * MS_PER_DAY + MS_PER_DAY;

/**
 * Read the Daily Challenge rankIndex for a user on the current UTC day.
 * Returns 1 (the default next-playable rank) when absent — including whenever the
 * date has rolled over since the user last played, which is the desired daily reset.
 */
export const getDailyProgress = async (userId: string): Promise<number> => {
  const raw = await redis.hGet(
    dailyProgressKey(userId, currentUtcDateStamp()),
    DAILY_CHALLENGE_SUBREDDIT
  );
  if (raw === undefined) return PROGRESS_DEFAULT;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : PROGRESS_DEFAULT;
};

/**
 * Atomically advance today's Daily Challenge rankIndex by 1 and return the new value.
 * Refreshes the hash TTL on every write so an active player's progress never expires
 * mid-day; the TTL is purely a cleanup safeguard since the dateStamp key segment is
 * what actually drives the daily reset.
 */
export const incrementDailyProgress = async (userId: string): Promise<number> => {
  const key = dailyProgressKey(userId, currentUtcDateStamp());
  const raw = await redis.hGet(key, DAILY_CHALLENGE_SUBREDDIT);

  let next: number;
  if (raw === undefined) {
    next = PROGRESS_DEFAULT + 1;
    await redis.hSet(key, { [DAILY_CHALLENGE_SUBREDDIT]: String(next) });
  } else {
    next = await redis.hIncrBy(key, DAILY_CHALLENGE_SUBREDDIT, 1);
  }

  await redis.expire(key, DAILY_PROGRESS_TTL_S);
  return next;
};

/** Overwrite today's Daily Challenge rankIndex (dev recovery only). */
export const setDailyProgress = async (
  userId: string,
  rankIndex: number
): Promise<void> => {
  const key = dailyProgressKey(userId, currentUtcDateStamp());
  await redis.hSet(key, { [DAILY_CHALLENGE_SUBREDDIT]: String(rankIndex) });
  await redis.expire(key, DAILY_PROGRESS_TTL_S);
};
