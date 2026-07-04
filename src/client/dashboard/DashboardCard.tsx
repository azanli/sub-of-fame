import type { SubredditDashboardCard } from '../../shared/api';
import {
  formatHiveIQDisplayText,
  resolveHiveIQDisplay,
} from '../../shared/hiveIQ';
import type { SubredditOption } from '../../shared/subreddits';
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

// Exported so other priority dashboard cards (e.g. DailyChallengeCard) can reuse the
// exact same geometric container and padding as standard curated subreddit cards.
export const cardButtonClasses =
  'flex w-full items-center gap-3 p-3 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60';

export const idleCardClasses =
  'rounded-xl border border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-700 dark:hover:bg-gray-700/50';

export const DashboardCard = (props: DashboardCardProps) => {
  const subreddit =
    props.kind === 'hydrated' ? props.card.subreddit : props.card.name;
  const displayName = props.card.displayName;
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
          r/{displayName}
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
              {props.card.completedRoundCount} Completed
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
