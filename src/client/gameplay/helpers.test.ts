import { describe, expect, it } from 'vitest';
import { CASUAL_REVEAL_CAPTIONS } from '../../shared/api';
import {
  applyTapRank,
  buildSubmitSlots,
  getCasualRevealCaption,
  isAllRanksAssigned,
} from './helpers';
import type { RankAssignments } from './types';

const comments = [
  { id: 'a', body: 'Comment A' },
  { id: 'b', body: 'Comment B' },
  { id: 'c', body: 'Comment C' },
] as const;

describe('applyTapRank', () => {
  it('assigns ranks in tap order', () => {
    let assignments: RankAssignments = new Map();

    assignments = applyTapRank(assignments, 'a');
    expect(assignments.get('a')).toBe(1);

    assignments = applyTapRank(assignments, 'b');
    expect(assignments.get('b')).toBe(2);

    assignments = applyTapRank(assignments, 'c');
    expect(assignments.get('c')).toBe(3);
  });

  it('clears later ranks when an earlier assignment is retapped', () => {
    let assignments: RankAssignments = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);

    assignments = applyTapRank(assignments, 'a');
    expect(assignments.size).toBe(0);
  });
});

describe('isAllRanksAssigned', () => {
  it('returns true only when three comments are ranked', () => {
    expect(isAllRanksAssigned(new Map())).toBe(false);
    expect(
      isAllRanksAssigned(
        new Map([
          ['a', 1],
          ['b', 2],
        ])
      )
    ).toBe(false);
    expect(
      isAllRanksAssigned(
        new Map([
          ['a', 1],
          ['b', 2],
          ['c', 3],
        ])
      )
    ).toBe(true);
  });
});

describe('buildSubmitSlots', () => {
  it('fills missing slots with remaining comments in order', () => {
    const assignments: RankAssignments = new Map([['b', 2]]);

    expect(buildSubmitSlots([...comments], assignments)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('returns ordered slots when all ranks are assigned', () => {
    const assignments: RankAssignments = new Map([
      ['c', 1],
      ['a', 2],
      ['b', 3],
    ]);

    expect(buildSubmitSlots([...comments], assignments)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });
});

describe('getCasualRevealCaption', () => {
  it('returns captions for casual scores 0, 1, and 3', () => {
    expect(getCasualRevealCaption(0)).toBe(CASUAL_REVEAL_CAPTIONS[0]);
    expect(getCasualRevealCaption(1)).toBe(CASUAL_REVEAL_CAPTIONS[1]);
    expect(getCasualRevealCaption(3)).toBe(CASUAL_REVEAL_CAPTIONS[3]);
  });

  it('returns null for unsupported scores', () => {
    expect(getCasualRevealCaption(2)).toBeNull();
    expect(getCasualRevealCaption(-1)).toBeNull();
  });
});
