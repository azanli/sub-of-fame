import { useEffect, useMemo, useState } from 'react';
import { applyTapRank, calculatePuzzleTimer } from './helpers';
import { CommentsModal } from './CommentsModal';
import { StartPuzzleGate } from './StartPuzzleGate';
import type { RankAssignments, ReadyPuzzle } from './types';

type GameplayRoundProps = {
  puzzle: ReadyPuzzle;
  onSubmit: (slots: [string, string, string]) => void;
};

type GameplayRoundInnerProps = GameplayRoundProps;

const GameplayRoundInner = ({ puzzle, onSubmit: _onSubmit }: GameplayRoundInnerProps) => {
  const allottedSeconds = useMemo(
    () => calculatePuzzleTimer(puzzle.comments),
    [puzzle.comments]
  );

  const [hasStarted, setHasStarted] = useState(false);
  const [assignments, setAssignments] = useState<RankAssignments>(new Map());
  const [secondsRemaining, setSecondsRemaining] = useState(allottedSeconds);

  useEffect(() => {
    if (!hasStarted || secondsRemaining <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [hasStarted, secondsRemaining]);

  const handleTap = (commentId: string) => {
    setAssignments((current) => applyTapRank(current, commentId));
  };

  if (!hasStarted) {
    return (
      <StartPuzzleGate
        rankIndex={puzzle.rankIndex}
        post={puzzle.post}
        onStart={() => setHasStarted(true)}
      />
    );
  }

  return (
    <CommentsModal
      comments={puzzle.comments}
      secondsRemaining={secondsRemaining}
      assignments={assignments}
      onTap={handleTap}
    />
  );
};

export const GameplayRound = ({ puzzle, onSubmit }: GameplayRoundProps) => (
  <GameplayRoundInner key={puzzle.attemptId} puzzle={puzzle} onSubmit={onSubmit} />
);
