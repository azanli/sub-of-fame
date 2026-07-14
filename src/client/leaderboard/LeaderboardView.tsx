import { useEffect, useState } from 'react';
import type { InitResponse, LeaderboardPageResponse } from '../../shared/api';
import { trpcClient } from '../trpc';
import { WalletBalanceBadge } from '../dashboard/WalletBalanceBadge';
import { HubLeaderboardView } from './HubLeaderboardView';
import { LeaderboardSkeleton } from './LeaderboardSkeleton';
import { SubredditLeaderboardView } from './SubredditLeaderboardView';

type LeaderboardViewProps = {
  initData: InitResponse;
  onBack: () => void;
};

export const LeaderboardView = ({ initData, onBack }: LeaderboardViewProps) => {
  const [data, setData] = useState<LeaderboardPageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    trpcClient.leaderboard.getPage
      .query({})
      .then((response) => {
        if (!cancelled) {
          setData(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load leaderboard. Please try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4">
      <div className="flex h-9 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to dashboard"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-base text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200 cursor-pointer"
        >
          ←
        </button>
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
          Leaderboard
        </h1>
        <div className="ml-auto">
          <WalletBalanceBadge coins={initData.coins ?? 0} />
        </div>
      </div>

      {error !== null && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {data === null && error === null && (
        <LeaderboardSkeleton isHub={initData.isHub} />
      )}

      {data !== null &&
        (data.isHub ? (
          <HubLeaderboardView data={data} />
        ) : (
          <SubredditLeaderboardView initData={initData} data={data} />
        ))}
    </div>
  );
};
