import { CommentRankCard } from './CommentRankCard';
import { CountdownTimer } from './CountdownTimer';
import type { RankAssignments, ReadyPuzzle } from './types';

type CommentsModalProps = {
  comments: ReadyPuzzle['comments'];
  secondsRemaining: number;
  assignments: RankAssignments;
  onTap: (commentId: string) => void;
  onSkip: () => void;
  isSkipping: boolean;
};

export const CommentsModal = ({
  comments,
  secondsRemaining,
  assignments,
  onTap,
  onSkip,
  isSkipping,
}: CommentsModalProps) => (
  <div className="fixed inset-0 z-20 flex flex-col bg-black/60 backdrop-blur-sm">
    <div className="flex flex-col gap-4 p-4 m-auto w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Rank the comments
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <CountdownTimer secondsRemaining={secondsRemaining} />
          <button
            type="button"
            onClick={onSkip}
            disabled={isSkipping}
            aria-label="Skip puzzle"
            className="flex h-8 shrink-0 items-center justify-center rounded-full border border-gray-300 px-3 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
          >
            Skip
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {comments.map((comment) => (
          <CommentRankCard
            key={comment.id}
            commentId={comment.id}
            body={comment.body}
            rank={assignments.get(comment.id)}
            onTap={onTap}
          />
        ))}
      </div>
    </div>
  </div>
);
