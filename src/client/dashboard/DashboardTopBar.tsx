import { WalletBalanceBadge } from './WalletBalanceBadge';

type DashboardTopBarProps = {
  coins: number | null;
  onLeaderboardClick?: () => void;
  showSettings?: boolean;
  isSettingsOpen?: boolean;
  onSettingsToggle?: () => void;
  settingsPanelId?: string;
};

const secondaryPillClasses =
  'inline-flex h-9 items-center justify-center border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-600 transition-colors cursor-pointer hover:border-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200';

export const DashboardTopBar = ({
  coins,
  onLeaderboardClick,
  showSettings = true,
  isSettingsOpen = false,
  onSettingsToggle,
  settingsPanelId,
}: DashboardTopBarProps) => (
  <div className="flex items-center justify-between mb-6">
    <WalletBalanceBadge coins={coins ?? 0} />

    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onLeaderboardClick}
        className={`${secondaryPillClasses} rounded-full px-4`}
      >
        <span className="inline-flex items-center gap-1">
          <span className="text-xs mr-1" aria-hidden="true">
            🏆
          </span>
          Leaderboard
        </span>
      </button>

      {showSettings && onSettingsToggle !== undefined ? (
        <button
          type="button"
          aria-expanded={isSettingsOpen}
          aria-controls={settingsPanelId}
          aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}
          onClick={onSettingsToggle}
          className={`${secondaryPillClasses} w-9 shrink-0 rounded-full`}
        >
          <span
            aria-hidden="true"
            className={`inline-block origin-center text-sm leading-none transition-transform duration-300 ease-out ${
              isSettingsOpen ? 'rotate-90' : 'rotate-0'
            }`}
          >
            ⚙️
          </span>
        </button>
      ) : null}
    </div>
  </div>
);
