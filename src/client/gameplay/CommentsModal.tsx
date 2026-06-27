import { CommentRankCard } from './CommentRankCard';
import { CountdownTimer } from './CountdownTimer';
import type { RankAssignments, ReadyPuzzle } from './types';

type CommentsModalProps = {
  comments: ReadyPuzzle['comments'];
  secondsRemaining: number;
  assignments: RankAssignments;
  onTap: (commentId: string) => void;
};

export const CommentsModal = ({
  comments,
  secondsRemaining,
  assignments,
  onTap,
}: CommentsModalProps) => (
  <div className="fixed inset-0 z-20 flex flex-col bg-black/60 backdrop-blur-sm">
    <div className="flex flex-col gap-4 p-4 m-auto w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Rank the comments
        </h3>
        <CountdownTimer secondsRemaining={secondsRemaining} />
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
