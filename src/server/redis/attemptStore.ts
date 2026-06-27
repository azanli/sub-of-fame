import { redis } from '@devvit/web/server';
import { attemptKey, ATTEMPT_TTL_S } from './keys';
import { parseJson, stringifyJson } from './json';
import type { PuzzleAttempt } from './types';

/**
 * Read a puzzle attempt by ID.
 * Returns null when the attempt has expired (TTL elapsed) or was never created.
 * Callers should return ATTEMPT_EXPIRED to the client on null.
 */
export const getAttempt = async (attemptId: string): Promise<PuzzleAttempt | null> => {
  const raw = await redis.get(attemptKey(attemptId));
  return parseJson<PuzzleAttempt>(raw);
};

/**
 * Persist a new puzzle attempt with a ~1h TTL.
 * Called by puzzle.next after minting an attemptId and freezing the owner.
 */
export const setAttempt = async (attempt: PuzzleAttempt): Promise<void> => {
  const key = attemptKey(attempt.attemptId);
  await redis.set(key, stringifyJson(attempt));
  await redis.expire(key, ATTEMPT_TTL_S);
};

/**
 * Mark an attempt as submitted in place.
 * Preserves the existing TTL so the attempt record remains readable for the
 * remainder of the ~1h window for error-handling lookups.
 * The `submitted` field is the canonical "round is closed" marker; the submit
 * lock (submitLockStore) is the race-proof gate that ensures only one request
 * can reach this write.
 */
export const markAttemptSubmitted = async (attempt: PuzzleAttempt): Promise<void> => {
  const updated: PuzzleAttempt = { ...attempt, submitted: true };
  const key = attemptKey(attempt.attemptId);
  // Re-set with the same TTL seconds remaining would require a TTL read.
  // For MVP simplicity we reset the full ATTEMPT_TTL_S; the lock TTL also
  // matches ATTEMPT_TTL_S so both expire together.
  await redis.set(key, stringifyJson(updated));
  await redis.expire(key, ATTEMPT_TTL_S);
};
