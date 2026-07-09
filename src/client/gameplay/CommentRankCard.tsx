import type { GameMode } from '../../shared/api';
import type { RankValue } from './types';

type CommentRankCardProps = {
  commentId: string;
  body: string;
  gameMode: GameMode;
  rank: RankValue | undefined;
  hintRank: RankValue | undefined;
  isCasualSelected: boolean;
  isCasualSelectionLocked: boolean;
  isHintLocked: boolean;
  isHintProcessing: boolean;
  onTap: (commentId: string) => void;
};

export const CommentRankCard = ({
  commentId,
  body,
  gameMode,
  rank,
  hintRank,
  isCasualSelected,
  isCasualSelectionLocked,
  isHintLocked,
  isHintProcessing,
  onTap,
}: CommentRankCardProps) => {
  const isExpertMode = gameMode === 'expert';
  const isHintRevealed = hintRank !== undefined;
  const isRanked = isExpertMode && rank !== undefined && !isHintRevealed;
  const isCasualSelectedStyle = !isExpertMode && isCasualSelected;
  const isDisabled = isCasualSelectionLocked || isHintLocked;
  const showProcessingOverlay = isHintProcessing && !isHintLocked;

  return (
    <button
      type="button"
      onClick={() => onTap(commentId)}
      disabled={isDisabled}
      className={`relative w-full shrink-0 rounded-xl border px-4 py-3 text-left backdrop-blur-[2px] transition-colors transition-opacity duration-300 ease-out ${
        isDisabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer'
      } ${
        isHintRevealed
          ? 'border-gray-300 bg-white/65 dark:border-gray-600 dark:bg-gray-800/65'
          : isRanked || isCasualSelectedStyle
            ? 'border-orange-500 bg-white/75 hover:bg-white/95 focus-visible:bg-white/95 dark:border-orange-500 dark:bg-gray-800/75 dark:hover:bg-orange-950/40 dark:focus-visible:bg-gray-800/95'
            : isExpertMode
              ? 'border-gray-200 bg-white/65 hover:bg-white/95 focus-visible:bg-white/95 dark:border-gray-700 dark:bg-gray-800/65 dark:hover:bg-gray-800/95 dark:focus-visible:bg-gray-800/95'
              : 'border-gray-200 bg-white/65 hover:border-orange-400 hover:bg-white/95 focus-visible:bg-white/95 dark:border-gray-700 dark:bg-gray-800/65 dark:hover:border-orange-600 dark:hover:bg-gray-800/95 dark:focus-visible:bg-gray-800/95'
      }`}
    >
      {showProcessingOverlay && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-pulse rounded-xl bg-gray-200/40 dark:bg-gray-600/30"
        />
      )}
      {isHintRevealed && (
        <div className="pointer-events-none absolute left-0 top-0 size-10">
          <div
            aria-hidden
            className="absolute inset-0 bg-gray-400 dark:bg-gray-500"
            style={{ clipPath: 'polygon(0 0, 85% 0, 0 85%)' }}
          />
          <span className="absolute left-1 top-1 text-sm font-bold leading-none text-white select-none">
            {hintRank}
          </span>
        </div>
      )}
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
