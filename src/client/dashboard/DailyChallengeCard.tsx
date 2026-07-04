import { cardButtonClasses, idleCardClasses } from './DashboardCard';
import { DailyChallengeCountdown } from './DailyChallengeCountdown';
import { SpinningLoadingCard } from './SpinningLoadingCard';

const DAILY_CHALLENGE_ICON_URL = '/fame-icon.png';
const DAILY_CHALLENGE_LABEL = '🔥 LIVE GAUNTLET';

type DailyChallengeCardProps = {
  resetsAt: number;
  onSelect: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

export const DailyChallengeCard = ({
  resetsAt,
  onSelect,
  isLoading = false,
  disabled = false,
}: DailyChallengeCardProps) => {
  const cardContent = (
    <>
      <img
        src={DAILY_CHALLENGE_ICON_URL}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover animate-[fade-in_ease-out_both]"
        style={{ animationDuration: '250ms' }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-semibold text-gray-900 dark:text-white">
          {DAILY_CHALLENGE_LABEL}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <DailyChallengeCountdown resetsAt={resetsAt} />
        </p>
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
