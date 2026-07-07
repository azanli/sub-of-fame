import type { CampaignTimeframe } from './campaignTimeframes';
import { CAMPAIGN_TIMEFRAMES } from './campaignTimeframes';

export type CampaignContext = {
  subredditName: string;
  timeframe: CampaignTimeframe;
};

export const DEFAULT_CAMPAIGN_TIMEFRAME: CampaignTimeframe = 'all';

export { CAMPAIGN_TIMEFRAMES };

export const CAMPAIGN_TIMEFRAME_IDS = CAMPAIGN_TIMEFRAMES.map((entry) => entry.id);
