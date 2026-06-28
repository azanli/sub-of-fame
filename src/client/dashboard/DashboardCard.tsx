import type { SubredditDashboardCard } from '../../shared/api';
import type { SubredditOption } from '../../shared/subreddits';

type HydratedCardProps = {
  kind: 'hydrated';
  card: SubredditDashboardCard;
  onSelect: (subreddit: string) => void;
};

type StaticCardProps = {
  kind: 'static';
  card: SubredditOption;
  onSelect: (subreddit: string) => void;
};

type DashboardCardProps = HydratedCardProps | StaticCardProps;

const formatDashboardAccuracy = (
  completedRoundCount: number,
  userSubredditHiveIQ: number | null
): string => {
  if (completedRoundCount < 3 || userSubredditHiveIQ === null) {
    return 'Calibrating';
  }

  return `${userSubredditHiveIQ.toFixed(1)}%`;
};

export const DashboardCard = (props: DashboardCardProps) => {
  const subreddit = props.kind === 'hydrated' ? props.card.subreddit : props.card.name;
  const displayName = props.card.displayName;
  const iconUrl = props.card.iconUrl;

  return (
    <button
      type="button"
      onClick={() => {
        props.onSelect(subreddit);
      }}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-700 dark:hover:bg-gray-700/50"
    >
      <img
        src={iconUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold text-gray-900 dark:text-white">
            r/{displayName}
          </p>
          {props.kind === 'hydrated' && (
            <p className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
              {formatDashboardAccuracy(
                props.card.completedRoundCount,
                props.card.userSubredditHiveIQ
              )}
            </p>
          )}
        </div>
        {props.kind === 'hydrated' && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {props.card.completedRoundCount} Puzzles Solved
            </p>
            {props.card.leaderboardRank !== null && (
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                #{props.card.leaderboardRank}
              </p>
            )}
          </div>
        )}
      </div>
    </button>
  );
};
