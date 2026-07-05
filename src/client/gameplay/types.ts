import type { PuzzleNextResponse } from '../../shared/api';

export type ReadyPuzzle = Extract<PuzzleNextResponse, { status: 'ready' }>;

export type RankValue = 1 | 2 | 3;

export type RankAssignments = Map<string, RankValue>;

export type GameplaySubmitPayload =
  | { gameMode: 'expert'; slots: [string, string, string] }
  | { gameMode: 'casual'; selectedCommentId: string };
