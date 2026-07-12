import { isDailyChallengeSubreddit } from './dailyChallenge';
import type { CampaignTimeframe } from './campaignTimeframes';
import { CAMPAIGN_TIMEFRAMES } from './campaignTimeframes';

export type CampaignContext = {
  subredditName: string;
  timeframe: CampaignTimeframe;
};

export const DEFAULT_CAMPAIGN_TIMEFRAME: CampaignTimeframe = 'all';

export { CAMPAIGN_TIMEFRAMES };

export const CAMPAIGN_TIMEFRAME_IDS = CAMPAIGN_TIMEFRAMES.map((entry) => entry.id);

/**
 * Volatile ladders where the same popular post can reappear after a reset or
 * short page-cache TTL: Daily Challenge (Gauntlet) plus `now` and `day` campaigns.
 */
export const campaignUsesRecentPlayGuard = (ctx: CampaignContext): boolean =>
  isDailyChallengeSubreddit(ctx.subredditName) ||
  ctx.timeframe === 'now' ||
  ctx.timeframe === 'day';
