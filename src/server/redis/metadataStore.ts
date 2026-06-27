import { redis } from '@devvit/web/server';
import { metadataKey, METADATA_TTL_S } from './keys';
import { parseJson, stringifyJson } from './json';
import type { SubredditMetadataCacheEntry } from './types';

/**
 * Read cached subreddit display metadata.
 * Returns null on cache miss or malformed stored value — callers should fall back
 * to a live reddit.getSubredditByName lookup.
 * Note: metadata cache existence is NOT dashboard membership.
 */
export const getMetadata = async (
  subredditName: string
): Promise<SubredditMetadataCacheEntry | null> => {
  const raw = await redis.get(metadataKey(subredditName));
  return parseJson<SubredditMetadataCacheEntry>(raw);
};

/**
 * Persist subreddit display metadata with a 7-day TTL.
 * Overwrites any existing cached value.
 */
export const setMetadata = async (
  subredditName: string,
  entry: SubredditMetadataCacheEntry
): Promise<void> => {
  await redis.set(metadataKey(subredditName), stringifyJson(entry));
  await redis.expire(metadataKey(subredditName), METADATA_TTL_S);
};
