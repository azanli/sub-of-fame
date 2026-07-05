import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode } from '../../shared/api';
import {
  applyTapRank,
  buildSubmitSlots,
  calculatePuzzleTimer,
  isAllRanksAssigned,
} from './helpers';
import { CommentsModal } from './CommentsModal';
import { StartPuzzleGate } from './StartPuzzleGate';
import type { GameplaySubmitPayload, RankAssignments, ReadyPuzzle } from './types';

type GameplayRoundProps = {
  puzzle: ReadyPuzzle;
  gameMode: GameMode;
  onSubmit: (payload: GameplaySubmitPayload) => void;
  onSkip: () => void;
  isSubmitting: boolean;
  isSkipping: boolean;
  onDashboard: () => void;
  coinBalance: number | null;
};

type GameplayRoundInnerProps = GameplayRoundProps;

const GameplayRoundInner = ({
  puzzle,
  gameMode,
  onSubmit,
  onSkip,
  isSubmitting,
  isSkipping,
  onDashboard,
  coinBalance,
}: GameplayRoundInnerProps) => {
  const isExpertMode = gameMode === 'expert';
  const allottedSeconds = useMemo(
    () => calculatePuzzleTimer(puzzle.comments),
    [puzzle.comments]
  );

  const hasSubmittedRef = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSkipAnimating, setIsSkipAnimating] = useState(false);
  const [assignments, setAssignments] = useState<RankAssignments>(new Map());
  const [secondsRemaining, setSecondsRemaining] = useState(allottedSeconds);

  useEffect(() => {
    hasSubmittedRef.current = false;
  }, [puzzle.attemptId]);

  useEffect(() => {
    if (
      !hasStarted ||
      secondsRemaining <= 0 ||
      isSubmitting ||
      isSkipping ||
      isSkipAnimating
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [hasStarted, secondsRemaining, isSubmitting, isSkipping, isSkipAnimating]);

  useEffect(() => {
    if (!isExpertMode) {
      return;
    }

    if (
      isSubmitting ||
      isSkipping ||
      isSkipAnimating ||
      hasSubmittedRef.current
    ) {
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
    onSubmit({ gameMode: 'expert', slots });
  }, [
    assignments,
    isExpertMode,
    isSubmitting,
    isSkipping,
    isSkipAnimating,
    onSubmit,
    puzzle.comments,
  ]);

  useEffect(() => {
    if (!isExpertMode) {
      return;
    }

    if (
      isSubmitting ||
      isSkipAnimating ||
      hasSubmittedRef.current
    ) {
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
    onSubmit({ gameMode: 'expert', slots });
  }, [
    assignments,
    isExpertMode,
    secondsRemaining,
    isSubmitting,
    isSkipping,
    hasStarted,
    onSubmit,
    puzzle.comments,
  ]);

  const handleExpertTap = (commentId: string) => {
    setAssignments((current) => applyTapRank(current, commentId));
  };

  const handleCasualTap = (commentId: string) => {
    if (
      isSubmitting ||
      isSkipping ||
      isSkipAnimating ||
      hasSubmittedRef.current
    ) {
      return;
    }

    hasSubmittedRef.current = true;
    onSubmit({ gameMode: 'casual', selectedCommentId: commentId });
  };

  const handleTap = isExpertMode ? handleExpertTap : handleCasualTap;

  const handleSkipAnimationStart = () => {
    if (isSubmitting || isSkipping || isSkipAnimating || hasSubmittedRef.current) {
      return;
    }

    hasSubmittedRef.current = true;
    setIsSkipAnimating(true);
  };

  const handleSkip = () => {
    if (isSubmitting || isSkipping) {
      return;
    }

    setIsSkipAnimating(false);
    onSkip();
  };

  if (!hasStarted) {
    return (
      <StartPuzzleGate
        subredditDisplayName={puzzle.subredditDisplayName}
        post={puzzle.post}
        numberOfComments={puzzle.numberOfComments}
        onStart={() => setHasStarted(true)}
        onExit={onDashboard}
      />
    );
  }

  return (
    <CommentsModal
      comments={puzzle.comments}
      gameMode={gameMode}
      secondsRemaining={secondsRemaining}
      totalSeconds={allottedSeconds}
      assignments={assignments}
      onTap={
        isSubmitting || isSkipping || isSkipAnimating
          ? () => undefined
          : handleTap
      }
      onSkipAnimationStart={handleSkipAnimationStart}
      onSkip={handleSkip}
      isSkipAnimating={isSkipAnimating}
      isSkipping={isSubmitting || isSkipping}
      coinBalance={coinBalance}
    />
  );
};

export const GameplayRound = ({
  puzzle,
  gameMode,
  onSubmit,
  onSkip,
  isSubmitting,
  isSkipping,
  onDashboard,
  coinBalance,
}: GameplayRoundProps) => (
  <GameplayRoundInner
    key={puzzle.attemptId}
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
