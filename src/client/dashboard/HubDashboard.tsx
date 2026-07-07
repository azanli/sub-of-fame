import { useMemo, useState, type FormEvent } from 'react';
import type { GameMode, InitResponse } from '../../shared/api';
import { SUBREDDIT_UNLOCK_COST } from '../../shared/coins';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';
import { DAILY_CHALLENGE_SUBREDDIT } from '../../shared/dailyChallenge';
import { resolveLoadingCard } from '../gameplay/resolveLoadingCard';
import { DailyChallengeCard } from './DailyChallengeCard';
import { DashboardCard } from './DashboardCard';
import { HubSettingsPanel } from './HubSettingsPanel';

type HubDashboardProps = {
  initData: InitResponse;
  onSelectSubreddit: (subreddit: string) => void;
  selectionError: string | null;
  loadingSubreddit?: string | null;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
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
  selectionError,
  loadingSubreddit = null,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
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

    // Strip leading 'r/', 'R/', '/r/', or '/R/', then trim whitespace
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
      <div className="flex items-center">
        {isLoggedIn && initData.coins !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-semibold text-orange-800 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
            <img
              src="/coin.svg"
              alt=""
              aria-hidden="true"
              className="h-5 w-5"
            />
            <span className="tabular-nums">{initData.coins}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => undefined}
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
          <button
            type="button"
            aria-expanded={isSettingsOpen}
            aria-controls={SETTINGS_PANEL_ID}
            aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}
            onClick={() => {
              setIsSettingsOpen((open) => !open);
            }}
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
        </div>
      </div>

      <HubSettingsPanel
        id={SETTINGS_PANEL_ID}
        isOpen={isSettingsOpen}
        gameMode={gameMode}
        onGameModeChange={onGameModeChange}
        isSavingGameMode={isSavingGameMode}
        gameModeError={gameModeError}
      />

      {initData.dailyChallenge !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Daily Challenge
          </p>
          <div className="flex flex-col gap-2 pr-1">
            <DailyChallengeCard
              resetsAt={initData.dailyChallenge.resetsAt}
              onSelect={() => {
                onSelectSubreddit(DAILY_CHALLENGE_SUBREDDIT);
              }}
              isLoading={isDailyChallengeLoading}
              disabled={isLoadingSelection && !isDailyChallengeLoading}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Campaigns
        </p>
        <div className="flex flex-col gap-2 pr-1">
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
        </div>
      </div>

      {initData.isHub && (
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
              className="shrink-0 rounded-full bg-[#d93900] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c23300] disabled:cursor-not-allowed disabled:opacity-60"
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
      )}
      <img
        className="mx-auto w-1/2 max-w-[220px] object-contain animate-[skip-snoo-rise_ease-out_both]"
        style={{ animationDuration: '700ms', animationDelay: '150ms' }}
        src="/snoo.png"
        alt="Snoo thinking about the hivemind"
      />
    </div>
  );
};
