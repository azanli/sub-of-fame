import { use } from 'react';
import { GameplayRound } from './GameplayRound';
import type { ReadyPuzzle } from './types';

type PuzzleGateFromPromiseProps = {
  puzzlePromise: Promise<ReadyPuzzle>;
  onSubmit: (slots: [string, string, string]) => void;
  onSkip: () => void;
  isSubmitting: boolean;
  isSkipping: boolean;
  onDashboard: () => void;
};

export const PuzzleGateFromPromise = ({
  puzzlePromise,
  onSubmit,
  onSkip,
  isSubmitting,
  isSkipping,
  onDashboard,
}: PuzzleGateFromPromiseProps) => {
  const puzzle = use(puzzlePromise);

  return (
    <GameplayRound
      puzzle={puzzle}
      onSubmit={onSubmit}
      onSkip={onSkip}
      isSubmitting={isSubmitting}
      isSkipping={isSkipping}
      onDashboard={onDashboard}
    />
  );
};
