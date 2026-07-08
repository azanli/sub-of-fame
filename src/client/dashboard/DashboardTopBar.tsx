import { WalletBalanceBadge } from './WalletBalanceBadge';

type DashboardTopBarProps = {
  coins: number | null;
  onLeaderboardClick?: () => void;
  showSettings?: boolean;
  isSettingsOpen?: boolean;
  onSettingsToggle?: () => void;
  settingsPanelId?: string;
};

export const DashboardTopBar = ({
  coins,
  onLeaderboardClick,
  showSettings = true,
  isSettingsOpen = false,
  onSettingsToggle,
  settingsPanelId,
}: DashboardTopBarProps) => (
  <div className="flex items-center">
    {coins !== null && <WalletBalanceBadge coins={coins} />}
    <div className="ml-auto flex items-center gap-2">
      <button
        type="button"
        // TODO: Remove for release
        onDoubleClick={onLeaderboardClick}
        className="text-sm font-semibold rounded-lg px-3 py-1.5 border transition-colors cursor-pointer
    text-[#d93900] border-[#d93900] bg-[#d93900]/10 hover:text-[#c23300] hover:border-[#c23300] hover:bg-[#d93900]/20
    dark:text-orange-400 dark:border-orange-400 dark:bg-orange-400/10 dark:hover:text-orange-300 dark:hover:border-orange-300 dark:hover:bg-orange-400/20"
      >
        <span className="inline-flex items-center gap-1">
          Leaderboard
          <span className="text-xs" aria-hidden="true">
            🏆
          </span>
        </span>
      </button>
      {showSettings && onSettingsToggle !== undefined && (
        <button
          type="button"
          aria-expanded={isSettingsOpen}
          aria-controls={settingsPanelId}
          aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}
          onClick={onSettingsToggle}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
        >
          <span
            aria-hidden="true"
            className={`inline-block origin-center leading-none transition-transform duration-300 ease-out ${
              isSettingsOpen ? 'rotate-90' : 'rotate-0'
            }`}
          >
            ⚙️
          </span>
        </button>
      )}
    </div>
  </div>
);
