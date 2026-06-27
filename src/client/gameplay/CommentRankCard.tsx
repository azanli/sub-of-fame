import type { RankValue } from './types';

const RANK_BADGES: Record<RankValue, string> = {
  1: '①',
  2: '②',
  3: '③',
};

type CommentRankCardProps = {
  commentId: string;
  body: string;
  rank: RankValue | undefined;
  onTap: (commentId: string) => void;
};

export const CommentRankCard = ({ commentId, body, rank, onTap }: CommentRankCardProps) => (
  <button
    type="button"
    onClick={() => onTap(commentId)}
    className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
  >
    <span className="shrink-0 w-7 h-7 flex items-center justify-center text-lg font-bold text-orange-500 select-none">
      {rank !== undefined ? RANK_BADGES[rank] : null}
    </span>
    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
      {body}
    </p>
  </button>
);
