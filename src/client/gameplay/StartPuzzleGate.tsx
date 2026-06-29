import { PuzzlePost } from './PuzzlePost';
import { formatSubredditLabel } from '../../shared/subreddits';
import { formatCompactNumber } from '../../shared/formatNumber';
import type { ReadyPuzzle } from './types';

type StartPuzzleGateProps = {
  subredditDisplayName: ReadyPuzzle['subredditDisplayName'];
  post: ReadyPuzzle['post'];
  numberOfComments: ReadyPuzzle['numberOfComments'];
  onStart: () => void;
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

export const StartPuzzleGate = ({
  subredditDisplayName,
  post,
  numberOfComments,
  onStart,
  onExit,
}: StartPuzzleGateProps) => (
  <>
    <div className="flex flex-col gap-6 p-4 pb-24">
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
              className="text-md text-gray-400 leading-none"
            >
              ×
            </span>
          </button>
          <p className="truncate text-sm font-medium text-gray-400 tracking-widest ml-2">
            {formatSubredditLabel(subredditDisplayName)}
          </p>
        </div>
        <span
          aria-label="Post comment count"
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400"
        >
          <CommentIcon />
          {formatCompactNumber(numberOfComments)} comments
        </span>
      </div>
      <PuzzlePost post={post} />
    </div>
    <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center border-t border-gray-200 bg-gray-50/95 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
      <button
        type="button"
        onClick={onStart}
        className="bg-[#d93900] hover:bg-[#c23300] text-white font-semibold rounded-full px-8 py-3 transition-colors cursor-pointer"
      >
        Start Ranking
      </button>
    </div>
  </>
);
