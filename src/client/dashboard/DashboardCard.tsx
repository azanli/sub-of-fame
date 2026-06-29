import type { SubredditDashboardCard } from '../../shared/api';
import type { SubredditOption } from '../../shared/subreddits';

type DashboardCardBaseProps = {
  onSelect: (subreddit: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
};

type HydratedCardProps = DashboardCardBaseProps & {
  kind: 'hydrated';
  card: SubredditDashboardCard;
};

type StaticCardProps = DashboardCardBaseProps & {
  kind: 'static';
  card: SubredditOption;
};

type DashboardCardProps = HydratedCardProps | StaticCardProps;

const formatDashboardAccuracy = (
  completedRoundCount: number,
  userSubredditHiveIQ: number | null
): string => {
  if (completedRoundCount === 0 || userSubredditHiveIQ === null) {
    return '—';
  } else if (completedRoundCount <= 3) {
    return 'Calibrating';
  }

  return `${userSubredditHiveIQ.toFixed(1)}%`;
};

const cardButtonClasses =
  'flex w-full items-center gap-3 p-3 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60';

const idleCardClasses =
  'rounded-xl border border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-700 dark:hover:bg-gray-700/50';

export const DashboardCard = (props: DashboardCardProps) => {
  const subreddit =
    props.kind === 'hydrated' ? props.card.subreddit : props.card.name;
  const displayName = props.card.displayName;
  const iconUrl = props.card.iconUrl;
  const isLoading = props.isLoading ?? false;
  const disabled = props.disabled ?? false;
  const accuracy = formatDashboardAccuracy(
    props.kind === 'hydrated' ? props.card.completedRoundCount : 0,
    props.kind === 'hydrated' ? props.card.userSubredditHiveIQ : null
  );

  const cardContent = (
    <>
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
              {accuracy}
              {accuracy.includes('%') ? ' 🎯' : ''}
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
    </>
  );

  if (isLoading) {
    return (
      <div className="relative rounded-xl">
        {/* 1. The Spinning Border Layer (Masked to only show the edges) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl p-[2px]"
          style={{
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        >
          <div className="absolute inset-[-100%] animate-spin bg-[conic-gradient(from_0deg,transparent_0deg,transparent_250deg,#fb923c_285deg,#d93900_360deg)]" />
        </div>

        {/* 2. The Card Content (Now free to use bg-transparent) */}
        <button
          type="button"
          disabled
          className={`${cardButtonClasses} relative z-10 rounded-xl border-0 bg-transparent`}
        >
          {cardContent}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        props.onSelect(subreddit);
      }}
      disabled={disabled}
      className={`${cardButtonClasses} ${idleCardClasses}`}
    >
      {cardContent}
    </button>
  );
};
