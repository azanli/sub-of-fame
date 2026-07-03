import { CommentRankCard } from './CommentRankCard';
import { CountdownTimer } from './CountdownTimer';
import type { RankAssignments, ReadyPuzzle } from './types';

type CommentsModalProps = {
  comments: ReadyPuzzle['comments'];
  secondsRemaining: number;
  totalSeconds: number;
  assignments: RankAssignments;
  onTap: (commentId: string) => void;
  onSkip: () => void;
  isSkipping: boolean;
  /** Logged-in wallet balance; null for guests (skip is free). */
  coinBalance: number | null;
};

const CoinIcon = ({ className }: { className: string }) => (
  <img src="/coin.svg" alt="" aria-hidden="true" className={className} />
);

export const CommentsModal = ({
  comments,
  secondsRemaining,
  totalSeconds,
  assignments,
  onTap,
  onSkip,
  isSkipping,
  coinBalance,
}: CommentsModalProps) => {
  const skipCostsCoin = coinBalance !== null;
  const cannotAffordSkip = skipCostsCoin && coinBalance < 1;

  return (
    <div className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      <CountdownTimer
        secondsRemaining={secondsRemaining}
        totalSeconds={totalSeconds}
      />
      <div className="mx-auto flex h-full w-full max-w-lg flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 p-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Rank the comments
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              disabled={isSkipping || cannotAffordSkip}
              aria-label="Skip puzzle for 1 Karma Coin"
              className={`flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
                cannotAffordSkip
                  ? 'border-red-300 text-red-500 dark:border-red-800 dark:text-red-400'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Skip
              {skipCostsCoin ? <CoinIcon className="h-4 w-4" /> : null}
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 pt-0">
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
};
