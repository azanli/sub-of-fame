import type { CampaignContext } from '../../shared/campaignContext';
import { isDailyChallengeSubreddit } from '../../shared/dailyChallenge';
import {
  getDailyProgress,
  incrementDailyProgress,
  setDailyProgress,
} from './dailyChallengeStore';
import { getProgress, incrementProgress, setProgress } from './progressStore';

export const getRankIndex = (userId: string, ctx: CampaignContext): Promise<number> =>
  isDailyChallengeSubreddit(ctx.subredditName)
    ? getDailyProgress(userId)
    : getProgress(userId, ctx);

export const advanceRankIndex = (userId: string, ctx: CampaignContext): Promise<number> =>
  isDailyChallengeSubreddit(ctx.subredditName)
    ? incrementDailyProgress(userId)
    : incrementProgress(userId, ctx);

export const setRankIndex = (
  userId: string,
  ctx: CampaignContext,
  rankIndex: number
): Promise<void> =>
  isDailyChallengeSubreddit(ctx.subredditName)
    ? setDailyProgress(userId, rankIndex)
    : setProgress(userId, ctx, rankIndex);
