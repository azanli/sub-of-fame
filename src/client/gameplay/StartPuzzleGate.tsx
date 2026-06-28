import { PuzzlePost } from './PuzzlePost';
import { formatSubredditLabel } from '../../shared/subreddits';
import type { ReadyPuzzle } from './types';

type StartPuzzleGateProps = {
  subredditDisplayName: ReadyPuzzle['subredditDisplayName'];
  post: ReadyPuzzle['post'];
  onStart: () => void;
};

export const StartPuzzleGate = ({
  subredditDisplayName,
  post,
  onStart,
}: StartPuzzleGateProps) => (
  <>
    <div className="flex flex-col gap-6 p-4 pb-24">
      <p className="text-sm font-medium text-gray-400 tracking-widest">
        {formatSubredditLabel(subredditDisplayName)}
      </p>
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
