import { use } from 'react';
import type { GameMode } from '../../shared/api';
import { GameplayRound } from './GameplayRound';
import type { GameplaySubmitPayload, ReadyPuzzle } from './types';

type PuzzleGateFromPromiseProps = {
  puzzlePromise: Promise<ReadyPuzzle>;
  gameMode: GameMode;
  onSubmit: (payload: GameplaySubmitPayload) => void;
  onSkip: () => void;
  isSubmitting: boolean;
  isSkipping: boolean;
  onDashboard: () => void;
  coinBalance: number | null;
};

export const PuzzleGateFromPromise = ({
  puzzlePromise,
  gameMode,
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
      gameMode={gameMode}
      onSubmit={onSubmit}
      onSkip={onSkip}
      isSubmitting={isSubmitting}
      isSkipping={isSkipping}
      onDashboard={onDashboard}
      coinBalance={coinBalance}
    />
  );
};
