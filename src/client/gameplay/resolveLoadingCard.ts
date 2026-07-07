import type { InitResponse, SubredditDashboardCard } from '../../shared/api';
import { CURATED_SUBREDDITS, type SubredditOption } from '../../shared/subreddits';

const DEFAULT_SUBREDDIT_ICON =
  'https://www.redditstatic.com/avatars/avatars-default-v2.png';

export type PuzzleLoadingCard =
  | { kind: 'hydrated'; card: SubredditDashboardCard }
  | { kind: 'static'; card: SubredditOption };

export const resolveLoadingCard = (
  subreddit: string,
  initData: InitResponse | null
): PuzzleLoadingCard => {
  const normalized = subreddit.toLowerCase();

  const hydrated = initData?.dashboardSubreddits?.find(
    (card) => card.subreddit.toLowerCase() === normalized
  );
  if (hydrated) {
    return { kind: 'hydrated', card: hydrated };
  }

  const curated = CURATED_SUBREDDITS.find(
    (card) => card.name.toLowerCase() === normalized
  );
  if (curated) {
    return { kind: 'static', card: curated };
  }

  return {
    kind: 'static',
    card: {
      name: subreddit,
      subreddit,
      iconUrl: DEFAULT_SUBREDDIT_ICON,
    },
  };
};
