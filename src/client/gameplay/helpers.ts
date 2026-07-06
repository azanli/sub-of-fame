import type { RankAssignments, RankValue, ReadyPuzzle } from './types';
import type { CasualRevealScore, GameMode } from '../../shared/api';
import {
  CASUAL_REVEAL_REMARKS,
  EXPERT_REVEAL_REMARKS,
  FORFEIT_REVEAL_REMARKS,
  getForfeitRevealRemarkKey,
  getRevealRemarkKey,
} from '../../shared/revealRemarks';

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

export const buildSubmitSlots = (
  comments: ReadyPuzzle['comments'],
  assignments: RankAssignments
): [string, string, string] | null => {
  const slots: Array<string | undefined> = [undefined, undefined, undefined];

  for (const [commentId, rank] of assignments) {
    slots[rank - 1] = commentId;
  }

  const placed = new Set(slots.filter((slot) => slot !== undefined));
  const remaining = comments
    .map((comment) => comment.id)
    .filter((commentId) => !placed.has(commentId));

  let nextRemainingIndex = 0;
  for (let index = 0; index < slots.length; index += 1) {
    if (slots[index] === undefined) {
      slots[index] = remaining[nextRemainingIndex];
      nextRemainingIndex += 1;
    }
  }

  const [first, second, third] = slots;
  if (first === undefined || second === undefined || third === undefined) {
    return null;
  }

  return [first, second, third];
};

const isCasualRevealScore = (score: number): score is CasualRevealScore =>
  score === 0 || score === 1 || score === 3;

const isExpertRevealScore = (score: number): score is 0 | 1 | 2 | 3 =>
  score === 0 || score === 1 || score === 2 || score === 3;

export const pickRevealRemarkIndex = (
  lastIndex: number | null,
  remarkCount: number
): number => {
  if (remarkCount <= 1) {
    return 0;
  }

  let index = Math.floor(Math.random() * remarkCount);
  while (index === lastIndex) {
    index = Math.floor(Math.random() * remarkCount);
  }
  return index;
};

export const formatRevealRemark = (
  template: string,
  subredditDisplayName: string
): string =>
  template
    .replace(/\{subredditName\}/g, subredditDisplayName)
    .replace(/\$\{subredditName\}/g, subredditDisplayName);

export type PickedRevealRemark = {
  key: string;
  index: number;
  text: string;
};

export const pickRevealRemark = ({
  gameMode,
  score,
  lastIndex,
  subredditDisplayName,
  forfeited = false,
}: {
  gameMode: GameMode;
  score: number;
  lastIndex: number | null;
  subredditDisplayName: string;
  forfeited?: boolean;
}): PickedRevealRemark | null => {
  if (forfeited) {
    const index = pickRevealRemarkIndex(lastIndex, FORFEIT_REVEAL_REMARKS.length);
    const template = FORFEIT_REVEAL_REMARKS[index] ?? FORFEIT_REVEAL_REMARKS[0];
    if (template === undefined) {
      return null;
    }

    return {
      key: getForfeitRevealRemarkKey(),
      index,
      text: formatRevealRemark(template, subredditDisplayName),
    };
  }

  const remarks =
    gameMode === 'casual'
      ? isCasualRevealScore(score)
        ? CASUAL_REVEAL_REMARKS[score]
        : null
      : isExpertRevealScore(score)
        ? EXPERT_REVEAL_REMARKS[score]
        : null;

  if (remarks === null || remarks.length === 0) {
    return null;
  }

  const index = pickRevealRemarkIndex(lastIndex, remarks.length);
  const template = remarks[index] ?? remarks[0];
  if (template === undefined) {
    return null;
  }

  return {
    key: getRevealRemarkKey(gameMode, score),
    index,
    text: formatRevealRemark(template, subredditDisplayName),
  };
};

export type CasualSlotHighlight = 'correct' | 'incorrect' | 'neutral';

export const resolveCasualSlotHighlight = (
  slotIndex: number,
  slot: { correct: boolean },
  score: number,
  forfeited = false
): CasualSlotHighlight => {
  if (forfeited) {
    return slotIndex === 0 ? 'incorrect' : 'neutral';
  }

  if (slot.correct) {
    return 'correct';
  }
  if (score === 1 && slotIndex === 1) {
    return 'incorrect';
  }
  if (score === 0 && slotIndex === 2) {
    return 'incorrect';
  }
  return 'neutral';
};
