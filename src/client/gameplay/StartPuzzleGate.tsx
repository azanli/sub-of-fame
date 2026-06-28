import { PuzzlePost } from './PuzzlePost';
import { formatSubredditLabel } from '../../shared/subreddits';
import type { ReadyPuzzle } from './types';

type StartPuzzleGateProps = {
  subredditDisplayName: ReadyPuzzle['subredditDisplayName'];
  post: ReadyPuzzle['post'];
  onStart: () => void;
  onExit: () => void;
};

export const StartPuzzleGate = ({
  subredditDisplayName,
  post,
  onStart,
  onExit,
}: StartPuzzleGateProps) => (
  <>
    <div className="flex flex-col gap-6 p-4 pb-24">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to dashboard"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
        >
          <span aria-hidden="true" className="text-md leading-none">
            ×
          </span>
        </button>
        <p className="text-sm font-medium text-gray-400 tracking-widest ml-2">
          {formatSubredditLabel(subredditDisplayName)}
        </p>
      </div>
      <PuzzlePost post={post} />
    </div>
    <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center border-t border-gray-200 bg-gray-50/95 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
      <button
        type="button"
        onClick={onStart}
        className="bg-[#d93900] hover:bg-[#c23300] text-white font-semibold rounded-full px-8 py-3 transition-colors cursor-pointer"
      >
        Start Puzzle
      </button>
    </div>
  </>
);
