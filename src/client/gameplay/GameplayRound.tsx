import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyTapRank,
  buildSubmitSlots,
  calculatePuzzleTimer,
  isAllRanksAssigned,
} from './helpers';
import { CommentsModal } from './CommentsModal';
import { StartPuzzleGate } from './StartPuzzleGate';
import type { RankAssignments, ReadyPuzzle } from './types';

type GameplayRoundProps = {
  puzzle: ReadyPuzzle;
  onSubmit: (slots: [string, string, string]) => void;
  isSubmitting: boolean;
};

type GameplayRoundInnerProps = GameplayRoundProps;

const GameplayRoundInner = ({
  puzzle,
  onSubmit,
  isSubmitting,
}: GameplayRoundInnerProps) => {
  const allottedSeconds = useMemo(
    () => calculatePuzzleTimer(puzzle.comments),
    [puzzle.comments]
  );

  const hasSubmittedRef = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [assignments, setAssignments] = useState<RankAssignments>(new Map());
  const [secondsRemaining, setSecondsRemaining] = useState(allottedSeconds);

  useEffect(() => {
    hasSubmittedRef.current = false;
  }, [puzzle.attemptId]);

  useEffect(() => {
    if (!hasStarted || secondsRemaining <= 0 || isSubmitting) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [hasStarted, secondsRemaining, isSubmitting]);

  useEffect(() => {
    if (isSubmitting || hasSubmittedRef.current) {
      return;
    }
    if (!isAllRanksAssigned(assignments)) {
      return;
    }

    const slots = buildSubmitSlots(puzzle.comments, assignments);
    if (slots === null) {
      return;
    }

    hasSubmittedRef.current = true;
    onSubmit(slots);
  }, [assignments, isSubmitting, onSubmit, puzzle.comments]);

  useEffect(() => {
    if (isSubmitting || hasSubmittedRef.current) {
      return;
    }
    if (!hasStarted || secondsRemaining > 0) {
      return;
    }

    const slots = buildSubmitSlots(puzzle.comments, assignments);
    if (slots === null) {
      return;
    }

    hasSubmittedRef.current = true;
    onSubmit(slots);
  }, [
    secondsRemaining,
    isSubmitting,
    hasStarted,
    onSubmit,
    puzzle.comments,
    assignments,
  ]);

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
      onTap={isSubmitting ? () => undefined : handleTap}
    />
  );
};

export const GameplayRound = ({ puzzle, onSubmit, isSubmitting }: GameplayRoundProps) => (
  <GameplayRoundInner
    key={puzzle.attemptId}
    puzzle={puzzle}
    onSubmit={onSubmit}
    isSubmitting={isSubmitting}
  />
);
