import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode } from '../../shared/api';
import {
  applyTapRank,
  buildHintAssignments,
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
  onHint: (attemptId: string) => Promise<string | null>;
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
  onHint,
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
  const [isHintAnimating, setIsHintAnimating] = useState(false);
  const [isHinting, setIsHinting] = useState(false);
  const [assignments, setAssignments] = useState<RankAssignments>(new Map());
  const [casualSelectedCommentId, setCasualSelectedCommentId] = useState<
    string | null
  >(null);
  const [hintedCommentId, setHintedCommentId] = useState<string | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(allottedSeconds);

  useEffect(() => {
    hasSubmittedRef.current = false;
    setCasualSelectedCommentId(null);
    setHintedCommentId(null);
    setHintUsed(false);
    setAssignments(new Map());
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
      isSkipAnimating ||
      isHintAnimating ||
      isHinting
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
    isHintAnimating,
    isHinting,
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
      isHintAnimating ||
      isHinting ||
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
    isHintAnimating,
    isHinting,
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
      isHintAnimating ||
      isHinting ||
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
    isHintAnimating,
    isHinting,
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
      isHintAnimating ||
      isHinting ||
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
    isHintAnimating,
    isHinting,
    hasStarted,
    onForfeit,
  ]);

  const handleExpertTap = (commentId: string) => {
    if (hintedCommentId === commentId) {
      return;
    }
    setAssignments((current) => applyTapRank(current, commentId));
  };

  const handleCasualTap = (commentId: string) => {
    if (
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
      isSkipAnimating ||
      isHintAnimating ||
      isHinting ||
      hasSubmittedRef.current ||
      casualSelectedCommentId !== null ||
      hintedCommentId === commentId
    ) {
      return;
    }

    hasSubmittedRef.current = true;
    setCasualSelectedCommentId(commentId);
    onSubmit({ gameMode: 'casual', selectedCommentId: commentId });
  };

  const handleTap = isExpertMode ? handleExpertTap : handleCasualTap;

  const handleSkipAnimationStart = () => {
    if (
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
      isSkipAnimating ||
      isHintAnimating ||
      isHinting ||
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

  const handleHintAnimationStart = () => {
    if (
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
      isSkipAnimating ||
      isHintAnimating ||
      isHinting ||
      hintUsed ||
      hasSubmittedRef.current
    ) {
      return;
    }

    setIsHintAnimating(true);
  };

  const handleHint = () => {
    if (isSubmitting || isSkipping || isHinting || hintUsed) {
      return;
    }

    setIsHintAnimating(false);
    setIsHinting(true);

    void onHint(puzzle.attemptId).then((commentId) => {
      setIsHinting(false);
      if (commentId === null) {
        return;
      }

      setHintedCommentId(commentId);
      setHintUsed(true);
      if (isExpertMode) {
        setAssignments(buildHintAssignments(commentId));
      }
    });
  };

  const handleBackToPost = () => {
    if (
      isExpertMode ||
      isSubmitting ||
      isSkipping ||
      isForfeiting ||
      isSkipAnimating ||
      isHintAnimating ||
      isHinting ||
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
      casualSelectedCommentId={casualSelectedCommentId}
      hintedCommentId={hintedCommentId}
      hintUsed={hintUsed}
      onTap={
        isSubmitting ||
        isSkipping ||
        isForfeiting ||
        isSkipAnimating ||
        isHintAnimating ||
        isHinting
          ? () => undefined
          : handleTap
      }
      onSkipAnimationStart={handleSkipAnimationStart}
      onSkip={handleSkip}
      onHintAnimationStart={handleHintAnimationStart}
      onHint={handleHint}
      isSkipAnimating={isSkipAnimating}
      isHintAnimating={isHintAnimating}
      isSkipping={isSubmitting || isSkipping || isForfeiting}
      isHinting={isHinting}
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
  onHint,
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
    onHint={onHint}
    onForfeit={onForfeit}
    isSubmitting={isSubmitting}
    isSkipping={isSkipping}
    isForfeiting={isForfeiting}
    onDashboard={onDashboard}
    coinBalance={coinBalance}
  />
);
