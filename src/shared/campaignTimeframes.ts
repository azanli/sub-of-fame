export type CampaignTimeframe =
  | 'all'
  | 'year'
  | 'month'
  | 'week'
  | 'day'
  | 'now';

export type CampaignTimeframeConfig = {
  id: CampaignTimeframe;
  title: string;
  description: string;
  icon: string;
};

export const CAMPAIGN_TIMEFRAMES: CampaignTimeframeConfig[] = [
  {
    id: 'all',
    title: 'Best of All Time',
    description: 'The undisputed legends of the community.',
    icon: '🏆',
  },
  {
    id: 'year',
    title: 'Best of This Year',
    description: 'The defining moments of the last 365 days.',
    icon: '📅',
  },
  {
    id: 'month',
    title: 'Best of This Month',
    description: 'The cultural shifts of the current month.',
    icon: '🗓️',
  },
  {
    id: 'week',
    title: 'Best of This Week',
    description: 'The most viral trends from the past 7 days.',
    icon: '📈',
  },
  {
    id: 'day',
    title: 'Best of Today',
    description: 'The biggest conversations happening right now.',
    icon: '🔥',
  },
  {
    id: 'now',
    title: 'Now (Live/Hot)',
    description: 'The hottest debates in the last hour.',
    icon: '⚡',
  },
];

/** Historical campaign cards shown under the Live Gauntlet hero. */
export const HISTORICAL_CAMPAIGN_TIMEFRAMES: CampaignTimeframeConfig[] =
  CAMPAIGN_TIMEFRAMES.filter(
    (campaign) => campaign.id !== 'day' && campaign.id !== 'now'
  );
