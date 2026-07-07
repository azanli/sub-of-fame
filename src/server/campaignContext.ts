import type { CampaignContext } from '../shared/campaignContext';
import { DEFAULT_CAMPAIGN_TIMEFRAME } from '../shared/campaignContext';
import type { CampaignTimeframe } from '../shared/campaignTimeframes';
import type { LaunchContext } from '../shared/api';
import { normalizeSubredditName, resolveRequestedSubreddit } from './launchContext';

type CampaignInput = {
  subreddit?: string;
  timeframe?: CampaignTimeframe;
};

export type ResolveCampaignContextResult =
  | { ok: true; ctx: CampaignContext }
  | {
      ok: false;
      code: 'SUBREDDIT_REQUIRED' | 'HOST_SUBREDDIT_LOCKED' | 'TIMEFRAME_REQUIRED';
    };

/**
 * Derive the effective campaign scope from launch context and request input.
 * Hub gameplay requires subreddit; community uses hostSubreddit.
 */
export const resolveCampaignContext = (
  launchContext: LaunchContext,
  input: CampaignInput
): ResolveCampaignContextResult => {
  const subredditResult = resolveRequestedSubreddit(launchContext, input.subreddit);
  if (!subredditResult.ok) {
    return { ok: false, code: subredditResult.code };
  }

  const timeframe = input.timeframe ?? DEFAULT_CAMPAIGN_TIMEFRAME;
  const validTimeframes: CampaignTimeframe[] = [
    'all',
    'year',
    'month',
    'week',
    'day',
    'now',
  ];
  if (!validTimeframes.includes(timeframe)) {
    return { ok: false, code: 'TIMEFRAME_REQUIRED' };
  }

  return {
    ok: true,
    ctx: {
      subredditName: normalizeSubredditName(subredditResult.subreddit) ?? subredditResult.subreddit,
      timeframe,
    },
  };
};
