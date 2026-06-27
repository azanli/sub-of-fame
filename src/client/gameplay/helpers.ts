import type { RankAssignments, RankValue, ReadyPuzzle } from './types';

export const calculatePuzzleTimer = (comments: ReadyPuzzle['comments']): number => {
  const combinedText = comments.map((comment) => comment.body).join(' ');
  const wordCount = Math.ceil(combinedText.length / 5);
  const calculatedSeconds = Math.ceil(wordCount / 2.5) + 15;

  return Math.min(120, Math.max(30, calculatedSeconds));
};

export const formatCountdown = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const getNextRank = (assignments: RankAssignments): RankValue | null => {
  if (![...assignments.values()].includes(1)) return 1;
  if (![...assignments.values()].includes(2)) return 2;
  if (![...assignments.values()].includes(3)) return 3;
  return null;
};

export const applyTapRank = (
  assignments: RankAssignments,
  commentId: string
): RankAssignments => {
  const selectedRank = assignments.get(commentId);
  const nextAssignments = new Map(assignments);

  if (selectedRank !== undefined) {
    for (const [assignedCommentId, rank] of nextAssignments) {
      if (rank >= selectedRank) {
        nextAssignments.delete(assignedCommentId);
      }
    }
    return nextAssignments;
  }

  const nextRank = getNextRank(assignments);
  if (nextRank === null) {
    return nextAssignments;
  }

  nextAssignments.set(commentId, nextRank);
  return nextAssignments;
};

export const isAllRanksAssigned = (assignments: RankAssignments): boolean =>
  assignments.size === 3;
