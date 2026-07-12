import { useMemo, useState, type FormEvent } from 'react';
import type { GameMode, InitResponse } from '../../shared/api';
import { SUBREDDIT_UNLOCK_COST } from '../../shared/coins';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';
import { DAILY_CHALLENGE_SUBREDDIT } from '../../shared/dailyChallenge';
import { resolveLoadingCard } from '../gameplay/resolveLoadingCard';
import { DailyChallengeCard } from './DailyChallengeCard';
import { DashboardCard } from './DashboardCard';
import { DashboardSection } from './DashboardSection';
import { DashboardTopBar } from './DashboardTopBar';
import { HubSettingsPanel } from './HubSettingsPanel';

type HubDashboardProps = {
  initData: InitResponse;
  onSelectSubreddit: (subreddit: string) => void;
  onLeaderboardClick?: () => void;
  selectionError: string | null;
  loadingSubreddit?: string | null;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
  onDeleteUserData: () => Promise<void>;
  isDeletingUserData?: boolean;
  deleteUserDataError?: string | null;
};

const SETTINGS_PANEL_ID = 'hub-settings-panel';

const matchesLoadingSubreddit = (
  subreddit: string,
  loadingSubreddit: string | null | undefined
): boolean =>
  loadingSubreddit !== null &&
  loadingSubreddit !== undefined &&
  loadingSubreddit.length > 0 &&
  subreddit.toLowerCase() === loadingSubreddit.toLowerCase();

export const HubDashboard = ({
  initData,
  onSelectSubreddit,
  onLeaderboardClick,
  selectionError,
  loadingSubreddit = null,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
  onDeleteUserData,
  isDeletingUserData = false,
  deleteUserDataError = null,
}: HubDashboardProps) => {
  const [customSubreddit, setCustomSubreddit] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isLoggedIn = initData.userGlobalHiveIQ !== null;
  const isLoadingSelection =
    loadingSubreddit !== null &&
    loadingSubreddit !== undefined &&
    loadingSubreddit.length > 0;

  const handleCustomSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (isLoadingSelection) {
      return;
    }

    const sanitized = customSubreddit.replace(/^\/?r\//i, '').trim();

    if (sanitized.length === 0) {
      return;
    }

    onSelectSubreddit(sanitized);
  };

  const isDailyChallengeLoading = matchesLoadingSubreddit(
    DAILY_CHALLENGE_SUBREDDIT,
    loadingSubreddit
  );

  const hasMatchingLoadingCard = useMemo(() => {
    if (!isLoadingSelection) {
      return false;
    }

    if (isDailyChallengeLoading) {
      return true;
    }

    if (initData.dashboardSubreddits !== null) {
      return initData.dashboardSubreddits.some((card) =>
        matchesLoadingSubreddit(card.subreddit, loadingSubreddit)
      );
    }

    return CURATED_SUBREDDITS.some((card) =>
      matchesLoadingSubreddit(card.name, loadingSubreddit)
    );
  }, [
    initData.dashboardSubreddits,
    isDailyChallengeLoading,
    isLoadingSelection,
    loadingSubreddit,
  ]);

  const customLoadingCard = useMemo(() => {
    if (
      !isLoadingSelection ||
      hasMatchingLoadingCard ||
      loadingSubreddit === null
    ) {
      return null;
    }

    return resolveLoadingCard(loadingSubreddit, initData);
  }, [hasMatchingLoadingCard, initData, isLoadingSelection, loadingSubreddit]);

  const cannotAffordUnlock =
    isLoggedIn &&
    initData.coins !== null &&
    initData.coins < SUBREDDIT_UNLOCK_COST;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4">
      <DashboardTopBar
        coins={isLoggedIn ? initData.coins : null}
        {...(onLeaderboardClick !== undefined ? { onLeaderboardClick } : {})}
        isSettingsOpen={isSettingsOpen}
        onSettingsToggle={() => {
          setIsSettingsOpen((open) => !open);
        }}
        settingsPanelId={SETTINGS_PANEL_ID}
      />

      <HubSettingsPanel
        id={SETTINGS_PANEL_ID}
        faqVariant="hub"
        isOpen={isSettingsOpen}
        gameMode={gameMode}
        onGameModeChange={onGameModeChange}
        isSavingGameMode={isSavingGameMode}
        gameModeError={gameModeError}
        isLoggedIn={isLoggedIn}
        onDeleteUserData={onDeleteUserData}
        isDeletingUserData={isDeletingUserData}
        deleteUserDataError={deleteUserDataError}
      />

      {initData.dailyChallenge !== null && (
        <DashboardSection label="Daily Challenge">
          <div className="rounded-xl animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] shadow-[0_0_15px_rgba(217,57,0,0.6)] border border-[#d93900]/50">
            <DailyChallengeCard
              resetsAt={initData.dailyChallenge.resetsAt}
              onSelect={() => {
                onSelectSubreddit(DAILY_CHALLENGE_SUBREDDIT);
              }}
              isLoading={isDailyChallengeLoading}
              disabled={isLoadingSelection && !isDailyChallengeLoading}
            />
          </div>
        </DashboardSection>
      )}

      <DashboardSection label="Campaigns">
        {customLoadingCard !== null && (
          <DashboardCard
            {...customLoadingCard}
            isLoading
            onSelect={() => undefined}
            disabled
          />
        )}
        {initData.dashboardSubreddits !== null
          ? initData.dashboardSubreddits.map((card) => {
              const isLoading = matchesLoadingSubreddit(
                card.subreddit,
                loadingSubreddit
              );

              if (isLoggedIn) {
                return (
                  <DashboardCard
                    key={card.subreddit}
                    kind="hydrated"
                    card={card}
                    onSelect={onSelectSubreddit}
                    isLoading={isLoading}
                    disabled={isLoadingSelection && !isLoading}
                  />
                );
              }

              return (
                <DashboardCard
                  key={card.subreddit}
                  kind="static"
                  card={{
                    name: card.subreddit,
                    subreddit: card.displayName,
                    iconUrl: card.iconUrl,
                  }}
                  onSelect={onSelectSubreddit}
                  isLoading={isLoading}
                  disabled={isLoadingSelection && !isLoading}
                />
              );
            })
          : CURATED_SUBREDDITS.map((card) => {
              const isLoading = matchesLoadingSubreddit(
                card.name,
                loadingSubreddit
              );

              return (
                <DashboardCard
                  key={card.name}
                  kind="static"
                  card={card}
                  onSelect={onSelectSubreddit}
                  isLoading={isLoading}
                  disabled={isLoadingSelection && !isLoading}
                />
              );
            })}
      </DashboardSection>

      <form onSubmit={handleCustomSubmit} className="flex flex-col gap-2">
        <label
          htmlFor="custom-subreddit"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Custom Subreddit
        </label>
        <div className="relative flex gap-2">
          <input
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            id="custom-subreddit"
            type="text"
            value={customSubreddit}
            onChange={(event) => {
              setCustomSubreddit(event.target.value);
            }}
            placeholder="e.g. r/dadjokes"
            disabled={isLoadingSelection}
            className="peer min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          {cannotAffordUnlock ? (
            <p
              aria-live="polite"
              className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-full text-sm text-orange-700 opacity-0 transition-opacity peer-focus:opacity-100 dark:text-orange-300"
            >
              You need {SUBREDDIT_UNLOCK_COST} coins to unlock a custom
              subreddit.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={
              isLoadingSelection ||
              customSubreddit.trim().length === 0 ||
              cannotAffordUnlock
            }
            className="shrink-0 rounded-full bg-[#d93900] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c23300] disabled:cursor-not-allowed disabled:opacity-60 enabled:cursor-pointer"
          >
            <span className="inline-flex items-center gap-1">
              Unlock
              <img
                src="/coin.svg"
                alt=""
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>
          </button>
        </div>
        {selectionError !== null && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {selectionError}
          </p>
        )}
      </form>

      <img
        className="mx-auto w-1/2 max-w-[220px] object-contain animate-[skip-snoo-rise_ease-out_both]"
        style={{ animationDuration: '700ms', animationDelay: '150ms' }}
        src="/snoo.png"
        alt="Snoo thinking about the hivemind"
      />
    </div>
  );
};
