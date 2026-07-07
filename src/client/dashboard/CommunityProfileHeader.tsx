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
            className="flex items-center gap-1 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
            aria-label={`Hive IQ ${hiveIQText}`}
          >
            {showHiveIQScore ? (
              <span aria-hidden="true">🧠 Hive IQ:</span>
            ) : null}
            <span className="tabular-nums">{hiveIQText}</span>
          </p>
        )}
        {leaderboardRank !== null && (
          <p className="flex items-center gap-1 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            <span aria-hidden="true">
              🏅 {formatSubredditLabel(displayName)} Rank:
            </span>
            <span className="tabular-nums">#{leaderboardRank}</span>
          </p>
        )}
      </div>
    </div>
  );
};
