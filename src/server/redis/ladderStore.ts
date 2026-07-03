import { redis } from '@devvit/web/server';
import {
  ladderPageKey,
  ladderCursorsKey,
  LADDER_CURSORS_TTL_S,
  resolveLadderPageSize,
  resolveLadderPageTtlS,
} from './keys';
import { parseJson, stringifyJson } from './json';
import type { LadderCachePage, LadderCursorChain } from './types';

// ─── Page helpers ─────────────────────────────────────────────────────────────

/**
 * Read a cached ladder page.
 * Returns null on cache miss or malformed data — callers fetch from Reddit and
 * call setLadderPage to warm the cache.
 * Page 1 = ranks 1–100, page N = ranks (N-1)*100+1 to N*100.
 */
export const getLadderPage = async (
  subredditName: string,
  page: number
): Promise<LadderCachePage | null> => {
  const raw = await redis.get(ladderPageKey(subredditName, page));
  return parseJson<LadderCachePage>(raw);
};

/**
 * Persist a ladder page with a subreddit-appropriate TTL (7 days for curated/custom
 * subreddits, a couple hours for the fast-moving r/all Daily Challenge — see
 * resolveLadderPageTtlS). Page content expiry is intentionally shorter than the cursor
 * chain TTL so the cursor chain can re-fetch a single page directly on content miss.
 */
export const setLadderPage = async (
  subredditName: string,
  page: number,
  data: LadderCachePage
): Promise<void> => {
  const key = ladderPageKey(subredditName, page);
  await redis.set(key, stringifyJson(data));
  await redis.expire(key, resolveLadderPageTtlS(subredditName));
};

// ─── Cursor chain helpers ─────────────────────────────────────────────────────

/**
 * Read the durable cursor chain for a subreddit.
 * Returns null when no cursor chain has been persisted yet.
 * The cursor chain is independent of page-content expiry and survives page TTL rollover.
 */
export const getCursorChain = async (
  subredditName: string
): Promise<LadderCursorChain | null> => {
  const raw = await redis.get(ladderCursorsKey(subredditName));
  return parseJson<LadderCursorChain>(raw);
};

/**
 * Persist the cursor chain with a 30-day TTL.
 * Must be called after every getTopPosts that extends the chain with a new startsAfter entry.
 */
export const setCursorChain = async (
  subredditName: string,
  chain: LadderCursorChain
): Promise<void> => {
  const key = ladderCursorsKey(subredditName);
  await redis.set(key, stringifyJson(chain));
  await redis.expire(key, LADDER_CURSORS_TTL_S);
};

// ─── Page derivation utility ──────────────────────────────────────────────────

/**
 * Derive the 1-based page number from a 1-based rankIndex.
 * Page size varies by subreddit — 50 for the Daily Challenge, 100 otherwise.
 */
export const rankIndexToPage = (rankIndex: number, subredditName: string): number =>
  Math.ceil(rankIndex / resolveLadderPageSize(subredditName));

/** Derive the 0-based offset within a page from a 1-based rankIndex. */
export const rankIndexToOffset = (rankIndex: number, subredditName: string): number =>
  (rankIndex - 1) % resolveLadderPageSize(subredditName);
