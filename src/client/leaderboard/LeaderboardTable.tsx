import type { LeaderboardRow as LeaderboardRowData } from '../../shared/api';
import { LeaderboardRow } from './LeaderboardRow';

type LeaderboardTableProps = {
  entries: LeaderboardRowData[];
};

export const LeaderboardTable = ({ entries }: LeaderboardTableProps) => {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No players on the leaderboard yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full min-w-[280px] border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            <th className="w-12 px-2 py-2">Rank</th>
            <th className="px-2 py-2">Player</th>
            <th className="w-24 px-2 py-2 text-right">Hive IQ</th>
            <th className="w-20 px-2 py-2 text-right">Streak</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {entries.map((row) => (
            <LeaderboardRow key={`${row.displayRank}-${row.username}`} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
