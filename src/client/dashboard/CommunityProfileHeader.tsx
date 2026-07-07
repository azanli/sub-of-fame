import {
  formatHiveIQDisplayText,
  type HiveIQDisplayState,
} from '../../shared/hiveIQ';
import { formatSubredditLabel } from '../../shared/subreddits';

type CommunityProfileHeaderProps = {
  iconUrl: string;
  displayName: string;
  hiveIQDisplay: HiveIQDisplayState | null;
  leaderboardRank: number | null;
};

export const CommunityProfileHeader = ({
  iconUrl,
  displayName,
  hiveIQDisplay,
  leaderboardRank,
}: CommunityProfileHeaderProps) => {
  const hiveIQText =
    hiveIQDisplay !== null ? formatHiveIQDisplayText(hiveIQDisplay) : null;
  const showHiveIQScore = hiveIQDisplay?.kind === 'score';

  return (
    <div className="flex items-center justify-between gap-4 mt-4">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={iconUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
        <p className="truncate text-lg font-bold text-gray-900 dark:text-white">
          {formatSubredditLabel(displayName)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {hiveIQText !== null && (
          <p
            className="flex items-center gap-0.5 text-sm text-gray-500 dark:text-gray-400"
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
        {leaderboardRank !== null && (
          <p className="flex items-center gap-0.5 text-sm font-medium text-orange-600 dark:text-orange-400">
            <span className="tabular-nums">#{leaderboardRank}</span>
            <span
              className="ml-1 inline-flex w-4 shrink-0 justify-center"
              aria-hidden="true"
            >
              🏆
            </span>
          </p>
        )}
      </div>
    </div>
  );
};
