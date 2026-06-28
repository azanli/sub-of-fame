import type { RankValue } from './types';

type CommentRankCardProps = {
  commentId: string;
  body: string;
  rank: RankValue | undefined;
  onTap: (commentId: string) => void;
};

export const CommentRankCard = ({
  commentId,
  body,
  rank,
  onTap,
}: CommentRankCardProps) => {
  const isRanked = rank !== undefined;

  return (
    <button
      type="button"
      onClick={() => onTap(commentId)}
      className={`relative w-full overflow-hidden rounded-xl border bg-white px-4 py-3 text-left transition-colors cursor-pointer dark:bg-gray-800 ${
        isRanked
          ? 'border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30'
          : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
      }`}
    >
      {isRanked && (
        <div className="pointer-events-none absolute left-0 top-0 size-11">
          <div
            aria-hidden
            className="absolute inset-0 bg-orange-500"
            style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
          />
          <span className="absolute left-[33%] top-[33%] -translate-x-1/2 -translate-y-1/2 text-sm font-bold leading-none text-white select-none">
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
