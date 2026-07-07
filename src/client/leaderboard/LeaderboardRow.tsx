import type { LeaderboardRow as LeaderboardRowData } from '../../shared/api';
import { formatHiveIQDisplayText } from '../../shared/hiveIQ';

type LeaderboardRowProps = {
  row: LeaderboardRowData;
};

export const LeaderboardRow = ({ row }: LeaderboardRowProps) => {
  const hiveIQText = formatHiveIQDisplayText(row.hiveIQDisplay);
  const showHiveIQScore = row.hiveIQDisplay.kind === 'score';

  return (
    <tr
      className={
        row.isCurrentUser
          ? 'bg-[#d93900]/10 dark:bg-orange-400/10'
          : 'bg-white dark:bg-gray-900'
      }
    >
      <td className="w-12 px-2 py-2 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
        {row.displayRank}
      </td>
      <td className="min-w-0 px-2 py-2 text-sm font-medium text-gray-900 dark:text-white">
        <span className="truncate">u/{row.username}</span>
      </td>
      <td className="w-24 px-2 py-2 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">
        <span className="inline-flex items-center justify-end gap-1">
          {showHiveIQScore ? (
            <span aria-hidden="true">🧠</span>
          ) : null}
          <span>{hiveIQText}</span>
        </span>
      </td>
    </tr>
  );
};
