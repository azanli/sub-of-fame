import type { PuzzleSubmitSuccess } from '../../shared/api';
import { formatSubredditLabel } from '../../shared/subreddits';
import type { ReadyPuzzle } from './types';

type RevealScreenProps = {
  result: PuzzleSubmitSuccess;
  puzzle: ReadyPuzzle;
  onNextLevel: () => void;
  onDashboard: () => void;
};

export const RevealScreen = ({
  result,
  puzzle,
  onNextLevel,
  onDashboard,
}: RevealScreenProps) => (
  <div className="fixed inset-0 flex flex-col overflow-hidden">
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 p-4 pb-6">
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-medium text-gray-400 tracking-widest">
            {formatSubredditLabel(puzzle.subredditDisplayName)}
          </p>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">
            {result.score} / 3
          </p>
        </div>
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
      <button
        type="button"
        onClick={onDashboard}
        className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-full px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
      >
        Dashboard
      </button>
      <button
        type="button"
        onClick={onNextLevel}
        className="bg-[#d93900] hover:bg-[#c23300] text-white font-semibold rounded-full px-6 py-2 transition-colors cursor-pointer"
      >
        Next Puzzle
      </button>
    </div>
  </div>
);
