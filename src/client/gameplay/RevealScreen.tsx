import { navigateTo } from '@devvit/web/client';
import type { PuzzleSubmitSuccess } from '../../shared/api';
import { formatCompactNumber } from '../../shared/formatNumber';
import { formatSubredditLabel } from '../../shared/subreddits';
import type { ReadyPuzzle } from './types';

type RevealScreenProps = {
  result: PuzzleSubmitSuccess;
  puzzle: ReadyPuzzle;
  onNextLevel: () => void;
  onExit: () => void;
};

const CommentIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const RevealScreen = ({
  result,
  puzzle,
  onNextLevel,
  onExit,
}: RevealScreenProps) => (
  <div className="fixed inset-0 flex flex-col overflow-hidden">
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 p-4 pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onExit}
              aria-label="Back to dashboard"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
            >
              <span
                aria-hidden="true"
                className="text-md text-gray-500 dark:text-gray-400 leading-none"
              >
                ×
              </span>
            </button>
            <p className="truncate text-sm font-medium text-gray-500 dark:text-gray-400 tracking-widest ml-2">
              {formatSubredditLabel(puzzle.subredditDisplayName)}
            </p>
          </div>
          <span
            aria-label="Post comment count"
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            <CommentIcon />
            {formatCompactNumber(puzzle.numberOfComments)} comments
          </span>
        </div>
        <p className="text-4xl font-bold text-gray-900 dark:text-white">
          {result.score} / 3
        </p>
        <div className="flex flex-col gap-3">
          {result.slots.map((slot, index) => (
            <div
              key={slot.commentId}
              className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
                slot.correct
                  ? 'border-green-400 bg-green-50 dark:bg-green-950'
                  : 'border-red-400 bg-red-50 dark:bg-red-950'
              }`}
            >
              <span className="shrink-0 text-sm font-bold text-gray-400 select-none [*{-webkit-touch-callout:none}]">
                #{index + 1}
              </span>
              <div className="flex flex-col gap-1 flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap select-none [*{-webkit-touch-callout:none}]">
                  {slot.body}
                </p>
                <p className="text-xs text-gray-400 select-none [*{-webkit-touch-callout:none}]">
                  {slot.score.toLocaleString()} upvotes
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="flex shrink-0 gap-3 justify-center border-t border-gray-200 bg-gray-50/95 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
      {puzzle.postUrl ? (
        <button
          type="button"
          onClick={() => navigateTo(puzzle.postUrl)}
          className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-full px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        >
          Open Post
        </button>
      ) : null}
      <button
        type="button"
        onClick={onNextLevel}
        className="bg-[#d93900] hover:bg-[#c23300] text-white font-semibold rounded-full px-6 py-2 transition-colors cursor-pointer"
      >
        Next Challenge
      </button>
    </div>
  </div>
);
