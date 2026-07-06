import { useEffect, useRef } from 'react';
import type { GameMode } from '../../shared/api';
import { CommentRankCard } from './CommentRankCard';
import { CountdownTimer } from './CountdownTimer';
import type { RankAssignments, ReadyPuzzle } from './types';

const SKIP_ANIMATION_MS = 700;

type CommentsModalProps = {
  comments: ReadyPuzzle['comments'];
  gameMode: GameMode;
  secondsRemaining: number;
  totalSeconds: number;
  assignments: RankAssignments;
  onTap: (commentId: string) => void;
  onSkipAnimationStart: () => void;
  onSkip: () => void;
  isSkipAnimating: boolean;
  isSkipping: boolean;
  /** Logged-in wallet balance; null for guests (skip is free). */
  coinBalance: number | null;
  /** Casual mode only: return to the post view and pause the timer. */
  onBackToPost?: () => void;
};

const CoinIcon = ({ className }: { className: string }) => (
  <img src="/coin.svg" alt="" aria-hidden="true" className={className} />
);

export const CommentsModal = ({
  comments,
  gameMode,
  secondsRemaining,
  totalSeconds,
  assignments,
  onTap,
  onSkipAnimationStart,
  onSkip,
  isSkipAnimating,
  isSkipping,
  coinBalance,
  onBackToPost,
}: CommentsModalProps) => {
  const skipTimeoutRef = useRef<number | null>(null);
  const cannotAffordSkip = (coinBalance ?? 0) < 1;
  const skipDisabled = isSkipping || isSkipAnimating || cannotAffordSkip;
  const isCasualMode = gameMode === 'casual';

  useEffect(() => {
    return () => {
      if (skipTimeoutRef.current !== null) {
        window.clearTimeout(skipTimeoutRef.current);
      }
    };
  }, []);

  const handleSkipClick = () => {
    if (skipDisabled) {
      return;
    }

    onSkipAnimationStart();
    skipTimeoutRef.current = window.setTimeout(() => {
      skipTimeoutRef.current = null;
      onSkip();
    }, SKIP_ANIMATION_MS);
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      <CountdownTimer
        secondsRemaining={secondsRemaining}
        totalSeconds={totalSeconds}
      />
      <div className="mx-auto flex h-full w-full max-w-lg flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-1">
            {onBackToPost !== undefined && (
              <button
                type="button"
                onClick={onBackToPost}
                aria-label="Back to post"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleSkipClick}
              disabled={skipDisabled}
              aria-label="Skip puzzle for 1 Karma Coin"
              aria-busy={isSkipAnimating}
              className={`flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
                cannotAffordSkip
                  ? 'border-red-300 text-red-500 dark:border-red-800 dark:text-red-400'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <span className="inline-flex min-w-[2.25rem] items-center justify-center">
                {isSkipAnimating ? (
                  <span
                    className="inline-block animate-[skip-cost-pop_700ms_ease-out_forwards]"
                    aria-hidden="true"
                  >
                    -1
                  </span>
                ) : (
                  'Skip'
                )}
              </span>
              <CoinIcon className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 pt-0">
          {comments.map((comment) => (
            <CommentRankCard
              key={comment.id}
              commentId={comment.id}
              body={comment.body}
              gameMode={gameMode}
              rank={isCasualMode ? undefined : assignments.get(comment.id)}
              onTap={onTap}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
