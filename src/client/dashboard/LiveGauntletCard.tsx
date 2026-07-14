import {
  formatHiveIQDisplayText,
  type HiveIQDisplayState,
} from '../../shared/hiveIQ';
import { cardButtonClasses, idleCardClasses } from './dashboardCardStyles';
import { DailyChallengeCountdown } from './DailyChallengeCountdown';
import { SpinningLoadingCard } from './SpinningLoadingCard';

const LIVE_GAUNTLET_LABEL = '🔥 LIVE GAUNTLET';

type LiveGauntletCardProps = {
  iconUrl: string;
  displayName: string;
  resetsAt: number;
  hiveIQDisplay: HiveIQDisplayState | null;
  leaderboardRank: number | null;
  onSelect: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

export const LiveGauntletCard = ({
  iconUrl,
  resetsAt,
  hiveIQDisplay,
  leaderboardRank,
  onSelect,
  isLoading = false,
  disabled = false,
}: LiveGauntletCardProps) => {
  const hiveIQText =
    hiveIQDisplay !== null
      ? formatHiveIQDisplayText(hiveIQDisplay)
      : 'Calibrating';

  const cardContent = (
    <>
      <img
        src={iconUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover animate-[fade-in_ease-out_both]"
        style={{ animationDuration: '250ms' }}
      />
      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
        <p className="truncate font-semibold text-gray-900 dark:text-white">
          {LIVE_GAUNTLET_LABEL}
        </p>
        <p
          className="flex shrink-0 items-center justify-end gap-0.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
          aria-label={`Hive IQ ${hiveIQText}`}
        >
          <span className="tabular-nums">{hiveIQText}</span>
          <span
            aria-hidden="true"
            className="ml-1 inline-flex w-4 shrink-0 justify-center"
          >
            🧠
          </span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <DailyChallengeCountdown resetsAt={resetsAt} />
        </p>
        {leaderboardRank !== null ? (
          <p className="flex shrink-0 items-center justify-end gap-0.5 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
            <span className="tabular-nums">#{leaderboardRank}</span>
            <span
              aria-hidden="true"
              className="ml-1 inline-flex w-4 shrink-0 justify-center"
            >
              🏆
            </span>
          </p>
        ) : (
          <span />
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
      onClick={onSelect}
      disabled={disabled}
      className={`${cardButtonClasses} ${idleCardClasses}`}
    >
      {cardContent}
    </button>
  );
};
