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
  coinBalance: number | null;
};

export const PuzzleGateFromPromise = ({
  puzzlePromise,
  onSubmit,
  onSkip,
  isSubmitting,
  isSkipping,
  onDashboard,
  coinBalance,
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
      coinBalance={coinBalance}
    />
  );
};
