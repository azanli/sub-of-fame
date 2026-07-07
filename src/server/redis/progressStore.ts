import { redis } from '@devvit/web/server';
import type { CampaignContext } from '../../shared/campaignContext';
import { progressField, parseProgressField } from './campaignKeys';
import { progressKey } from './keys';

const PROGRESS_DEFAULT = 1;

const resolveStoredField = (ctx: CampaignContext): string => progressField(ctx);

/**
 * Read the stored rankIndex for one campaign scope.
 * Supports lazy migration from legacy `{subreddit}` fields to `{subreddit}:all`.
 */
export const getProgress = async (
  userId: string,
  ctx: CampaignContext
): Promise<number> => {
  const key = progressKey(userId);
  const field = resolveStoredField(ctx);

  const raw = await redis.hGet(key, field);
  if (raw !== undefined) {
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : PROGRESS_DEFAULT;
  }

  if (ctx.timeframe === 'all') {
    const legacyRaw = await redis.hGet(key, ctx.subredditName);
    if (legacyRaw !== undefined) {
      const parsed = parseInt(legacyRaw, 10);
      return Number.isFinite(parsed) ? parsed : PROGRESS_DEFAULT;
    }
  }

  return PROGRESS_DEFAULT;
};

export const setProgress = async (
  userId: string,
  ctx: CampaignContext,
  rankIndex: number
): Promise<void> => {
  const key = progressKey(userId);
  const field = resolveStoredField(ctx);
  await redis.hSet(key, { [field]: String(rankIndex) });

  if (ctx.timeframe === 'all') {
    await redis.hDel(key, [ctx.subredditName]);
  }
};

export const incrementProgress = async (
  userId: string,
  ctx: CampaignContext
): Promise<number> => {
  const key = progressKey(userId);
  const field = resolveStoredField(ctx);
  const current = await getProgress(userId, ctx);
  const next = current + 1;
  await redis.hSet(key, { [field]: String(next) });

  if (ctx.timeframe === 'all') {
    await redis.hDel(key, [ctx.subredditName]);
  }

  return next;
};

/**
 * Return all campaign scopes stored in the progress hash.
 * Legacy subreddit-only fields are normalized to timeframe `all`.
 */
export const getAllProgress = async (
  userId: string
): Promise<Record<string, Record<CampaignContext['timeframe'], number>>> => {
  const raw = await redis.hGetAll(progressKey(userId));
  const result: Record<string, Record<CampaignContext['timeframe'], number>> = {};

  for (const [field, value] of Object.entries(raw)) {
    const parsedField = parseProgressField(field);
    if (parsedField === null) continue;

    const rankIndex = parseInt(value, 10);
    const normalizedRank = Number.isFinite(rankIndex) ? rankIndex : PROGRESS_DEFAULT;

    if (!result[parsedField.subredditName]) {
      result[parsedField.subredditName] = {} as Record<CampaignContext['timeframe'], number>;
    }
    result[parsedField.subredditName]![parsedField.timeframe] = normalizedRank;
  }

  return result;
};

export type ParsedProgressEntry = {
  subredditName: string;
  timeframe: CampaignContext['timeframe'];
  rankIndex: number;
};

/** Flat list of parsed progress entries for dashboard discovery. */
export const listProgressEntries = async (userId: string): Promise<ParsedProgressEntry[]> => {
  const nested = await getAllProgress(userId);
  const entries: ParsedProgressEntry[] = [];

  for (const [subredditName, timeframes] of Object.entries(nested)) {
    for (const [timeframe, rankIndex] of Object.entries(timeframes)) {
      entries.push({
        subredditName,
        timeframe: timeframe as CampaignContext['timeframe'],
        rankIndex,
      });
    }
  }

  return entries;
};
