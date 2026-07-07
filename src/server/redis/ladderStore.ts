import { redis } from '@devvit/web/server';
import type { CampaignContext } from '../../shared/campaignContext';
import {
  campaignLadderCursorsKey,
  campaignLadderPageKey,
  resolveCampaignLadderPageSize,
  resolveCampaignLadderPageTtlS,
} from './campaignKeys';
import { LADDER_CURSORS_TTL_S } from './keys';
import { parseJson, stringifyJson } from './json';
import type { LadderCachePage, LadderCursorChain } from './types';

export const getLadderPage = async (
  ctx: CampaignContext,
  page: number
): Promise<LadderCachePage | null> => {
  const raw = await redis.get(campaignLadderPageKey(ctx, page));
  return parseJson<LadderCachePage>(raw);
};

export const setLadderPage = async (
  ctx: CampaignContext,
  page: number,
  data: LadderCachePage
): Promise<void> => {
  const key = campaignLadderPageKey(ctx, page);
  await redis.set(key, stringifyJson(data));
  await redis.expire(key, resolveCampaignLadderPageTtlS(ctx));
};

export const getCursorChain = async (
  ctx: CampaignContext
): Promise<LadderCursorChain | null> => {
  const raw = await redis.get(campaignLadderCursorsKey(ctx));
  return parseJson<LadderCursorChain>(raw);
};

export const setCursorChain = async (
  ctx: CampaignContext,
  chain: LadderCursorChain
): Promise<void> => {
  const key = campaignLadderCursorsKey(ctx);
  await redis.set(key, stringifyJson(chain));
  await redis.expire(key, LADDER_CURSORS_TTL_S);
};

export const rankIndexToPage = (rankIndex: number, ctx: CampaignContext): number =>
  Math.ceil(rankIndex / resolveCampaignLadderPageSize(ctx));

export const rankIndexToOffset = (rankIndex: number, ctx: CampaignContext): number =>
  (rankIndex - 1) % resolveCampaignLadderPageSize(ctx);
