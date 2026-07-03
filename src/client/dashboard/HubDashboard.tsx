import { useMemo, useState, type FormEvent } from 'react';
import type { InitResponse } from '../../shared/api';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';
import { resolveLoadingCard } from '../gameplay/resolveLoadingCard';
import { DashboardCard } from './DashboardCard';

type HubDashboardProps = {
  initData: InitResponse;
  onSelectSubreddit: (subreddit: string) => void;
  selectionError: string | null;
  loadingSubreddit?: string | null;
};

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
}: HubDashboardProps) => {
  const [customSubreddit, setCustomSubreddit] = useState('');
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

  const hasMatchingLoadingCard = useMemo(() => {
    if (!isLoadingSelection) {
      return false;
    }

    if (isLoggedIn && initData.dashboardSubreddits !== null) {
      return initData.dashboardSubreddits.some((card) =>
        matchesLoadingSubreddit(card.subreddit, loadingSubreddit)
      );
    }

    return CURATED_SUBREDDITS.some((card) =>
      matchesLoadingSubreddit(card.name, loadingSubreddit)
    );
  }, [
    initData.dashboardSubreddits,
    isLoadingSelection,
    isLoggedIn,
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

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4">
      <div className="flex flex-col gap-2">
        {/* <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 dark:border-gray-600">
          <img
            src="/fame-icon.png"
            alt="Sub of Fame"
            className="h-full w-full object-cover"
          />
        </div> */}
        {/* <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Pick a subreddit campaign to start ranking comments.
        </p> */}
      </div>

      {/* {initData.userGlobalHiveIQ !== null && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
            Your Karma Accuracy
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {initData.userGlobalHiveIQ.userGlobalHiveIQ !== null
              ? `${initData.userGlobalHiveIQ.userGlobalHiveIQ.toFixed(1)}%`
              : 'No rounds played yet'}
          </p>
        </div>
      )} */}

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
          {isLoggedIn && initData.dashboardSubreddits !== null
            ? initData.dashboardSubreddits.map((card) => {
                const isLoading = matchesLoadingSubreddit(
                  card.subreddit,
                  loadingSubreddit
                );

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
          <div className="flex gap-2">
            <input
              id="custom-subreddit"
              type="text"
              value={customSubreddit}
              onChange={(event) => {
                setCustomSubreddit(event.target.value);
              }}
              placeholder="e.g. r/dadjokes"
              disabled={isLoadingSelection}
              className="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={
                isLoadingSelection || customSubreddit.trim().length === 0
              }
              className="shrink-0 rounded-full bg-[#d93900] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c23300] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Go
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
        className="mx-auto w-1/2 max-w-[220px] object-contain"
        src="/snoo.png"
        alt="Snoo thinking about the hivemind"
      />
    </div>
  );
};
