import type { PuzzleSubmitSuccess } from '../../shared/api';
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
  <div className="flex flex-col gap-6 p-4">
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
        Rank #{puzzle.rankIndex}
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
          <span className="shrink-0 text-sm font-bold text-gray-500">
            #{index + 1}
          </span>
          <div className="flex flex-col gap-1 flex-1">
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {slot.body}
            </p>
            <p className="text-xs text-gray-500">
              {slot.score.toLocaleString()} upvotes
            </p>
          </div>
          <span className="shrink-0 text-lg">{slot.correct ? '✓' : '✗'}</span>
        </div>
      ))}
    </div>
    <div className="flex gap-3 justify-center">
      <button
        type="button"
        onClick={onDashboard}
        className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-full px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        Dashboard
      </button>
      <button
        type="button"
        onClick={onNextLevel}
        className="bg-[#d93900] hover:bg-[#c23300] text-white font-semibold rounded-full px-6 py-2 transition-colors"
      >
        Next Puzzle
      </button>
    </div>
  </div>
);
