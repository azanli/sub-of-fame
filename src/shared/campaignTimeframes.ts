export type CampaignTimeframe = 'all' | 'year' | 'month' | 'week' | 'day' | 'now';

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
    description: 'Climb the all-time top posts ladder.',
    icon: '🏆',
  },
  {
    id: 'year',
    title: 'Best of This Year',
    description: 'Rank the top posts from this year.',
    icon: '📅',
  },
  {
    id: 'month',
    title: 'Best of This Month',
    description: 'Rank the top posts from this month.',
    icon: '🗓️',
  },
  {
    id: 'week',
    title: 'Best of This Week',
    description: 'Rank the top posts from this week.',
    icon: '📈',
  },
  {
    id: 'day',
    title: 'Best of Today',
    description: 'Rank the top posts from today.',
    icon: '🔥',
  },
  {
    id: 'now',
    title: 'Now (Live/Hot)',
    description: 'Play the hottest posts right now.',
    icon: '⚡',
  },
];
