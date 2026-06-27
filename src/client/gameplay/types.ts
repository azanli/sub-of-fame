import type { PuzzleNextResponse } from '../../shared/api';

export type ReadyPuzzle = Extract<PuzzleNextResponse, { status: 'ready' }>;

export type RankValue = 1 | 2 | 3;

export type RankAssignments = Map<string, RankValue>;
