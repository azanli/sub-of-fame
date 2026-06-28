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
  onSkip: () => void;
  isSubmitting: boolean;
  isSkipping: boolean;
  onDashboard: () => void;
};

type GameplayRoundInnerProps = GameplayRoundProps;

const GameplayRoundInner = ({
  puzzle,
  onSubmit,
  onSkip,
  isSubmitting,
  isSkipping,
  onDashboard,
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
    if (!hasStarted || secondsRemaining <= 0 || isSubmitting || isSkipping) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [hasStarted, secondsRemaining, isSubmitting, isSkipping]);

  useEffect(() => {
    if (isSubmitting || isSkipping || hasSubmittedRef.current) {
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
  }, [assignments, isSubmitting, isSkipping, onSubmit, puzzle.comments]);

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
    isSkipping,
    hasStarted,
    onSubmit,
    puzzle.comments,
    assignments,
  ]);

  const handleTap = (commentId: string) => {
    setAssignments((current) => applyTapRank(current, commentId));
  };

  const handleSkip = () => {
    if (isSubmitting || isSkipping || hasSubmittedRef.current) {
      return;
    }

    hasSubmittedRef.current = true;
    onSkip();
  };

  if (!hasStarted) {
    return (
      <StartPuzzleGate
        subredditDisplayName={puzzle.subredditDisplayName}
        post={puzzle.post}
        onStart={() => setHasStarted(true)}
        onExit={onDashboard}
      />
    );
  }

  return (
    <CommentsModal
      comments={puzzle.comments}
      secondsRemaining={secondsRemaining}
      assignments={assignments}
      onTap={isSubmitting || isSkipping ? () => undefined : handleTap}
      onSkip={handleSkip}
      isSkipping={isSubmitting || isSkipping}
    />
  );
};

export const GameplayRound = ({
  puzzle,
  onSubmit,
  onSkip,
  isSubmitting,
  isSkipping,
  onDashboard,
}: GameplayRoundProps) => (
  <GameplayRoundInner
    key={puzzle.attemptId}
    puzzle={puzzle}
    onSubmit={onSubmit}
    onSkip={onSkip}
    isSubmitting={isSubmitting}
    isSkipping={isSkipping}
    onDashboard={onDashboard}
  />
);
