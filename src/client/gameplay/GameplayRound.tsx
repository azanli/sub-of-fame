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
  onForfeit: () => void;
  isSubmitting: boolean;
  isSkipping: boolean;
  isForfeiting: boolean;
  onDashboard: () => void;
  coinBalance: number | null;
};

type GameplayRoundInnerProps = GameplayRoundProps;

const FORFEIT_TRANSITION_MS = 700;

const GameplayRoundInner = ({
  puzzle,
  gameMode,
  onSubmit,
  onSkip,
  onForfeit,
  isSubmitting,
  isSkipping,
  isForfeiting,
  onDashboard,
  coinBalance,
}: GameplayRoundInnerProps) => {
  const isExpertMode = gameMode === 'expert';
  const allottedSeconds = useMemo(
    () => calculatePuzzleTimer(puzzle.comments),
    [puzzle.comments]
  );

  const hasSubmittedRef = useRef(false);
  const forfeitTimeoutRef = useRef<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSkipAnimating, setIsSkipAnimating] = useState(false);
  const [assignments, setAssignments] = useState<RankAssignments>(new Map());
  const [secondsRemaining, setSecondsRemaining] = useState(allottedSeconds);

  useEffect(() => {
    hasSubmittedRef.current = false;
    if (forfeitTimeoutRef.current !== null) {
      window.clearTimeout(forfeitTimeoutRef.current);
      forfeitTimeoutRef.current = null;
    }
  }, [puzzle.attemptId]);

  useEffect(() => {
    return () => {
      if (forfeitTimeoutRef.current !== null) {
        window.clearTimeout(forfeitTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !hasStarted ||
      secondsRemaining <= 0 ||
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
      isSkipAnimating
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [
    hasStarted,
    secondsRemaining,
    isSubmitting,
    isSkipping,
    isForfeiting,
    isSkipAnimating,
  ]);

  useEffect(() => {
    if (!isExpertMode) {
      return;
    }

    if (
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
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
    isForfeiting,
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
      isSkipping ||
      isForfeiting ||
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
    isForfeiting,
    isSkipAnimating,
    hasStarted,
    onSubmit,
    puzzle.comments,
  ]);

  useEffect(() => {
    if (isExpertMode) {
      return;
    }

    if (
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
      isSkipAnimating ||
      hasSubmittedRef.current
    ) {
      return;
    }
    if (!hasStarted || secondsRemaining > 0) {
      return;
    }

    hasSubmittedRef.current = true;
    forfeitTimeoutRef.current = window.setTimeout(() => {
      forfeitTimeoutRef.current = null;
      onForfeit();
    }, FORFEIT_TRANSITION_MS);

    return () => {
      if (forfeitTimeoutRef.current !== null) {
        window.clearTimeout(forfeitTimeoutRef.current);
        forfeitTimeoutRef.current = null;
      }
    };
  }, [
    isExpertMode,
    secondsRemaining,
    isSubmitting,
    isSkipping,
    isForfeiting,
    isSkipAnimating,
    hasStarted,
    onForfeit,
  ]);

  const handleExpertTap = (commentId: string) => {
    setAssignments((current) => applyTapRank(current, commentId));
  };

  const handleCasualTap = (commentId: string) => {
    if (
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
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
    if (
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
      isSkipAnimating ||
      hasSubmittedRef.current
    ) {
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

  const handleBackToPost = () => {
    if (
      isExpertMode ||
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
      isSkipAnimating ||
      hasSubmittedRef.current
    ) {
      return;
    }

    setHasStarted(false);
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
        isSubmitting || isSkipping || isForfeiting || isSkipAnimating
          ? () => undefined
          : handleTap
      }
      onSkipAnimationStart={handleSkipAnimationStart}
      onSkip={handleSkip}
      isSkipAnimating={isSkipAnimating}
      isSkipping={isSubmitting || isSkipping || isForfeiting}
      coinBalance={coinBalance}
      {...(isExpertMode ? {} : { onBackToPost: handleBackToPost })}
    />
  );
};

export const GameplayRound = ({
  puzzle,
  gameMode,
  onSubmit,
  onSkip,
  onForfeit,
  isSubmitting,
  isSkipping,
  isForfeiting,
  onDashboard,
  coinBalance,
}: GameplayRoundProps) => (
  <GameplayRoundInner
    key={puzzle.attemptId}
    puzzle={puzzle}
    gameMode={gameMode}
    onSubmit={onSubmit}
    onSkip={onSkip}
    onForfeit={onForfeit}
    isSubmitting={isSubmitting}
    isSkipping={isSkipping}
    isForfeiting={isForfeiting}
    onDashboard={onDashboard}
    coinBalance={coinBalance}
  />
);
