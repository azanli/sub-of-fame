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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to dashboard"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
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
