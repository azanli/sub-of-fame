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
  <div className="flex flex-col gap-6 p-4">
    <p className="text-sm font-medium text-gray-400 tracking-widest">
      {formatSubredditLabel(subredditDisplayName)}
    </p>
    <PuzzlePost post={post} />
    <button
      type="button"
      onClick={onStart}
      className="self-center bg-[#d93900] hover:bg-[#c23300] text-white font-semibold rounded-full px-8 py-3 transition-colors"
    >
      Start Puzzle
    </button>
  </div>
);
