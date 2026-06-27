import { redis } from '@devvit/web/server';
import { submitLockKey, SUBMIT_LOCK_TTL_S } from './keys';

/**
 * Attempt to acquire the duplicate-submit lock for an attempt.
 *
 * Returns true  → this request holds the lock and may proceed with scoring,
 *                 marking the attempt submitted, advancing stats/progress/leaderboard,
 *                 and returning the reveal payload.
 * Returns false → another request already holds the lock; caller must return
 *                 ATTEMPT_ALREADY_SUBMITTED without scoring or reveal.
 *
 * Implementation: uses `SET key value NX expiration:Date` which maps to the
 * atomic Redis `SET key value NX EX seconds` command. The Devvit Redis client
 * accepts a Date for expiration and converts it to seconds internally.
 *
 * When NX fails (key already exists), the Devvit client returns an empty string
 * rather than the usual 'OK'. We detect success by checking for the 'OK' return value.
 *
 * The lock TTL matches ATTEMPT_TTL_S so both expire together.
 */
export const acquireSubmitLock = async (attemptId: string): Promise<boolean> => {
  const key = submitLockKey(attemptId);
  const expiration = new Date(Date.now() + SUBMIT_LOCK_TTL_S * 1000);
  const result = await redis.set(key, '1', { nx: true, expiration });
  return result === 'OK';
};
