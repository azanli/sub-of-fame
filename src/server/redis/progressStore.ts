import { redis } from '@devvit/web/server';
import { progressKey } from './keys';

const PROGRESS_DEFAULT = 1;

/**
 * Read the stored rankIndex for one subreddit.
 * Returns 1 (the default next-playable rank) when the field is absent.
 * rankIndex is a 1-based next-playable pointer, not a count of puzzles solved.
 */
export const getProgress = async (userId: string, subredditName: string): Promise<number> => {
  const raw = await redis.hGet(progressKey(userId), subredditName);
  if (raw === undefined) return PROGRESS_DEFAULT;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : PROGRESS_DEFAULT;
};

/**
 * Overwrite the rankIndex for one subreddit (e.g. during recovery or migration).
 * Prefer `incrementProgress` for normal forward advancement.
 */
export const setProgress = async (
  userId: string,
  subredditName: string,
  rankIndex: number
): Promise<void> => {
  await redis.hSet(progressKey(userId), { [subredditName]: String(rankIndex) });
};

/**
 * Atomically advance the rankIndex for one subreddit by 1 and return the new value.
 * Used on invalid-post skips and successful submits.
 */
export const incrementProgress = async (
  userId: string,
  subredditName: string
): Promise<number> => {
  const key = progressKey(userId);
  const raw = await redis.hGet(key, subredditName);
  if (raw === undefined) {
    const next = PROGRESS_DEFAULT + 1;
    await redis.hSet(key, { [subredditName]: String(next) });
    return next;
  }
  return redis.hIncrBy(key, subredditName, 1);
};

/**
 * Return all subreddit→rankIndex entries stored in the progress hash.
 * Used by `init` to discover which custom subreddits have persisted progress.
 * Returns an empty object when no progress exists.
 */
export const getAllProgress = async (userId: string): Promise<Record<string, number>> => {
  const raw = await redis.hGetAll(progressKey(userId));
  const result: Record<string, number> = {};
  for (const [sub, value] of Object.entries(raw)) {
    const parsed = parseInt(value, 10);
    result[sub] = Number.isFinite(parsed) ? parsed : PROGRESS_DEFAULT;
  }
  return result;
};
