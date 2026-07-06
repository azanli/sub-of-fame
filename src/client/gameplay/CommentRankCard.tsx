import type { GameMode } from '../../shared/api';
import type { RankValue } from './types';

type CommentRankCardProps = {
  commentId: string;
  body: string;
  gameMode: GameMode;
  rank: RankValue | undefined;
  onTap: (commentId: string) => void;
};

export const CommentRankCard = ({
  commentId,
  body,
  gameMode,
  rank,
  onTap,
}: CommentRankCardProps) => {
  const isExpertMode = gameMode === 'expert';
  const isRanked = isExpertMode && rank !== undefined;

  return (
    <button
      type="button"
      onClick={() => onTap(commentId)}
      className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left backdrop-blur-[2px] transition-colors cursor-pointer ${
        isRanked
          ? 'border-orange-500 bg-white/75 hover:bg-white/95 focus-visible:bg-white/95 dark:border-orange-500 dark:bg-gray-800/75 dark:hover:bg-orange-950/40 dark:focus-visible:bg-gray-800/95'
          : isExpertMode
            ? 'border-gray-200 bg-white/65 hover:bg-white/95 focus-visible:bg-white/95 dark:border-gray-700 dark:bg-gray-800/65 dark:hover:bg-gray-800/95 dark:focus-visible:bg-gray-800/95'
            : 'border-gray-200 bg-white/65 hover:border-orange-400 hover:bg-white/95 focus-visible:bg-white/95 dark:border-gray-700 dark:bg-gray-800/65 dark:hover:border-orange-600 dark:hover:bg-gray-800/95 dark:focus-visible:bg-gray-800/95'
      }`}
    >
      {isRanked && (
        <div className="pointer-events-none absolute left-0 top-0 size-10">
          <div
            aria-hidden
            className="absolute inset-0 bg-orange-500"
            style={{ clipPath: 'polygon(0 0, 85% 0, 0 85%)' }}
          />
          <span className="absolute left-1 top-1 text-sm font-bold leading-none text-white select-none">
            {rank}
          </span>
        </div>
      )}
      <p className="text-sm text-gray-800 dark:text-gray-200 ml-4 leading-relaxed whitespace-pre-wrap">
        {body}
      </p>
    </button>
  );
};
