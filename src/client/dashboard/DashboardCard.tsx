import type { SubredditDashboardCard } from '../../shared/api';
import {
  formatHiveIQDisplayText,
  resolveHiveIQDisplay,
} from '../../shared/hiveIQ';
import type { SubredditOption } from '../../shared/subreddits';
import { formatSubredditLabel } from '../../shared/subreddits';
import { cardButtonClasses, idleCardClasses } from './dashboardCardStyles';
import { SpinningLoadingCard } from './SpinningLoadingCard';

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

export const DashboardCard = (props: DashboardCardProps) => {
  const subreddit =
    props.kind === 'hydrated' ? props.card.subreddit : props.card.name;
  const iconUrl = props.card.iconUrl;
  const isLoading = props.isLoading ?? false;
  const disabled = props.disabled ?? false;
  const hiveIQDisplay =
    props.kind === 'hydrated'
      ? resolveHiveIQDisplay(
          props.card.userSubredditHiveIQ,
          props.card.completedRoundCount
        )
      : null;
  const hiveIQText =
    hiveIQDisplay !== null ? formatHiveIQDisplayText(hiveIQDisplay) : null;
  const showHiveIQScore = hiveIQDisplay?.kind === 'score';

  const cardContent = (
    <>
      <img
        src={iconUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
      <div
        className={
          props.kind === 'hydrated'
            ? 'grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1'
            : 'flex min-w-0 flex-1 flex-col gap-1'
        }
      >
        <p className="truncate font-semibold text-gray-900 dark:text-white">
          {formatSubredditLabel(subreddit)}
        </p>
        {props.kind === 'hydrated' && hiveIQText !== null && (
          <p
            className="flex shrink-0 items-center justify-end gap-0.5 text-sm text-gray-500 dark:text-gray-400"
            aria-label={`Hive IQ ${hiveIQText}`}
          >
            <span className="tabular-nums">{hiveIQText}</span>
            {showHiveIQScore ? (
              <span
                className="ml-1 inline-flex w-4 shrink-0 justify-center"
                aria-hidden="true"
              >
                🧠
              </span>
            ) : null}
          </p>
        )}
        {props.kind === 'hydrated' && (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="tabular-nums">
                {props.card.completedRoundCount}
              </span>{' '}
              Completed
              {!!props.card.currentStreak && (
                <>
                  <span
                    // Turned into an inline-block circle with custom dimensions (w-1.5 h-1.5)
                    className="mx-2 inline-block h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600"
                    aria-hidden="true"
                  />
                  🔥{' '}
                  <span className="tabular-nums">
                    {props.card.currentStreak}
                  </span>
                </>
              )}
            </p>
            {props.card.leaderboardRank !== null && (
              <p className="flex shrink-0 items-center justify-end gap-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                <span className="tabular-nums">
                  #{props.card.leaderboardRank}
                </span>
                <span
                  className="ml-1 inline-flex w-4 shrink-0 justify-center"
                  aria-hidden="true"
                >
                  🏆
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </>
  );

  if (isLoading) {
    return <SpinningLoadingCard>{cardContent}</SpinningLoadingCard>;
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
