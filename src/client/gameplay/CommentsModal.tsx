import { useEffect, useRef } from 'react';
import type { GameMode } from '../../shared/api';
import { HINT_COST, SKIP_COST } from '../../shared/coins';
import { CoinBalanceBadge } from '../components/CoinBalanceBadge';
import { CommentRankCard } from './CommentRankCard';
import { CountdownTimer } from './CountdownTimer';
import { RescueBeamScene } from './RescueBeamScene';
import { RescueSpaceship } from './RescueBeamScene/RescueSpaceship';
import { getRescueAnimationState } from './rescueAnimation';
import type { RankAssignments, ReadyPuzzle } from './types';

const SKIP_ANIMATION_MS = 700;

type CommentsModalProps = {
  comments: ReadyPuzzle['comments'];
  gameMode: GameMode;
  secondsRemaining: number;
  totalSeconds: number;
  assignments: RankAssignments;
  casualSelectedCommentId: string | null;
  hintedCommentId: string | null;
  hintUsed: boolean;
  onTap: (commentId: string) => void;
  onSkipAnimationStart: () => void;
  onSkip: () => void;
  onHint: () => void;
  isSkipAnimating: boolean;
  isHintAnimating: boolean;
  isSkipping: boolean;
  isHintProcessing: boolean;
  /** Logged-in wallet balance; null for guests (skip is free). */
  coinBalance: number | null;
  /** Casual mode only: return to the post view and pause the timer. */
  onBackToPost?: () => void;
};

const CoinIcon = ({ className }: { className: string }) => (
  <img src="/coin.svg" alt="" aria-hidden="true" className={className} />
);

const StackedCoinIcon = ({
  className,
  isAnimating,
}: {
  className: string;
  isAnimating: boolean;
}) => (
  <span
    className={`relative inline-block h-4 w-6 shrink-0${
      isAnimating ? ' animate-[skip-cost-pop_150ms_ease-out_forwards]' : ''
    }`}
    aria-hidden="true"
  >
    <CoinIcon className={`${className} absolute left-0 top-0`} />
    <CoinIcon className={`${className} absolute left-[45%] top-0`} />
  </span>
);

export const CommentsModal = ({
  comments,
  gameMode,
  secondsRemaining,
  totalSeconds,
  assignments,
  casualSelectedCommentId,
  hintedCommentId,
  hintUsed,
  onTap,
  onSkipAnimationStart,
  onSkip,
  onHint,
  isSkipAnimating,
  isHintAnimating,
  isSkipping,
  isHintProcessing,
  coinBalance,
  onBackToPost,
}: CommentsModalProps) => {
  const skipTimeoutRef = useRef<number | null>(null);
  const cannotAffordSkip =
    coinBalance !== null && coinBalance < SKIP_COST;
  const cannotAffordHint = coinBalance !== null && coinBalance < HINT_COST;
  const skipDisabled = isSkipping || isSkipAnimating || cannotAffordSkip;
  const hintDisabled =
    hintUsed ||
    isHintProcessing ||
    isHintAnimating ||
    isSkipping ||
    cannotAffordHint;
  const isCasualMode = gameMode === 'casual';
  const rescueAnimationState = getRescueAnimationState(
    secondsRemaining,
    totalSeconds
  );

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

  const handleHintClick = () => {
    if (hintDisabled) {
      return;
    }

    onHint();
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      <CountdownTimer
        secondsRemaining={secondsRemaining}
        totalSeconds={totalSeconds}
      />
      <div className="relative mx-auto flex h-full w-full max-w-lg flex-col">
        <div className="relative z-[5] flex shrink-0 items-center justify-between gap-3 p-4">
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
          <div className="flex shrink-0 items-center justify-end gap-2">
            {coinBalance !== null ? (
              <CoinBalanceBadge coins={coinBalance} variant="neutral" />
            ) : null}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 flex justify-center"
          >
            <RescueSpaceship phase={rescueAnimationState.phase} />
          </div>
        </div>
        <div className="relative z-0 min-h-0 flex-1 flex flex-col">
          <RescueBeamScene animationState={rescueAnimationState} />
          <div className="relative z-[4] flex flex-1 flex-col gap-3 overflow-y-auto p-4 pt-0">
            {comments.map((comment) => (
              <CommentRankCard
                key={comment.id}
                commentId={comment.id}
                body={comment.body}
                gameMode={gameMode}
                rank={isCasualMode ? undefined : assignments.get(comment.id)}
                hintRank={hintedCommentId === comment.id ? 3 : undefined}
                isCasualSelected={casualSelectedCommentId === comment.id}
                isCasualSelectionLocked={
                  isCasualMode &&
                  casualSelectedCommentId !== null &&
                  casualSelectedCommentId !== comment.id
                }
                isHintLocked={hintedCommentId === comment.id}
                isHintProcessing={isHintProcessing}
                onTap={onTap}
              />
            ))}
          </div>
        </div>
        <div className="relative z-[5] shrink-0 border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSkipClick}
              disabled={skipDisabled}
              aria-label={`Skip puzzle for ${SKIP_COST} Karma Coin`}
              aria-busy={isSkipAnimating}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
            >
              <span>Skip</span>
              <CoinIcon
                className={`h-4 w-4 shrink-0${
                  isSkipAnimating
                    ? ' animate-[skip-cost-pop_700ms_ease-out_forwards]'
                    : ''
                }`}
              />
            </button>
            <button
              type="button"
              onClick={handleHintClick}
              disabled={hintDisabled}
              aria-label={`Reveal third-most-upvoted comment for ${HINT_COST} Karma Coins`}
              aria-busy={isHintAnimating || isHintProcessing}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border-2 border-orange-300 bg-orange-50 px-4 text-sm font-semibold text-orange-900 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-200 dark:hover:bg-orange-950/70 cursor-pointer"
            >
              <span>Hint</span>
              <StackedCoinIcon
                className="h-4 w-4"
                isAnimating={isHintAnimating}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
