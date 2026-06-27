import { redis } from '@devvit/web/server';
import { snapshotKey, SNAPSHOT_TTL_S } from './keys';
import { parseJson, stringifyJson } from './json';
import type { PuzzleSnapshot } from './types';

/**
 * Read a frozen puzzle snapshot containing the true comment rank order.
 * Returns null on cache miss or malformed data.
 * A missing snapshot after a valid attempt was served should return SNAPSHOT_MISSING
 * from puzzle.submit — callers must handle null appropriately.
 */
export const getSnapshot = async (sourcePostId: string): Promise<PuzzleSnapshot | null> => {
  const raw = await redis.get(snapshotKey(sourcePostId));
  return parseJson<PuzzleSnapshot>(raw);
};

/**
 * Persist a puzzle snapshot with a 7-day TTL.
 * Created once per valid post during puzzle.next; subsequent requests reuse the
 * cached snapshot so comment scores remain frozen for the duration of the TTL.
 */
export const setSnapshot = async (
  sourcePostId: string,
  snapshot: PuzzleSnapshot
): Promise<void> => {
  const key = snapshotKey(sourcePostId);
  await redis.set(key, stringifyJson(snapshot));
  await redis.expire(key, SNAPSHOT_TTL_S);
};
