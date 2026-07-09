import { describe, expect, it, vi } from 'vitest';
import {
  CASUAL_REVEAL_REMARKS,
  EXPERT_REVEAL_REMARKS,
  FORFEIT_REVEAL_REMARKS,
  SKIP_REVEAL_REMARKS,
} from '../../shared/revealRemarks';
import {
  applyTapRank,
  buildHintAssignments,
  buildSubmitSlots,
  formatRevealRemark,
  isAllRanksAssigned,
  pickRevealRemark,
  pickRevealRemarkIndex,
  pickSkipRevealRemark,
  resolveCasualSlotHighlight,
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

describe('buildHintAssignments', () => {
  it('assigns rank 3 to the hinted comment', () => {
    const assignments = buildHintAssignments('c');
    expect(assignments.get('c')).toBe(3);
    expect(assignments.size).toBe(1);
  });

  it('supports completing expert rankings after a hint', () => {
    let assignments = buildHintAssignments('c');

    assignments = applyTapRank(assignments, 'a');
    expect(assignments.get('a')).toBe(1);
    expect(assignments.get('c')).toBe(3);

    assignments = applyTapRank(assignments, 'b');
    expect(assignments.get('b')).toBe(2);
    expect(isAllRanksAssigned(assignments)).toBe(true);
  });

  it('clears partial rankings when hint is reapplied', () => {
    const partialAssignments: RankAssignments = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    expect(partialAssignments.size).toBe(2);

    const assignments = buildHintAssignments('c');
    expect(assignments.size).toBe(1);
    expect(assignments.get('c')).toBe(3);
    expect(assignments.has('a')).toBe(false);
    expect(assignments.has('b')).toBe(false);
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

describe('formatRevealRemark', () => {
  it('substitutes subreddit name placeholders', () => {
    expect(
      formatRevealRemark('You over-estimated r/{subredditName}.', 'AskReddit')
    ).toBe('You over-estimated r/AskReddit.');
    expect(
      formatRevealRemark(
        'The psychology of r/{subredditName} remains unsolved.',
        'pics'
      )
    ).toBe('The psychology of r/pics remains unsolved.');
  });
});

describe('pickRevealRemarkIndex', () => {
  it('returns 0 when there is only one remark', () => {
    expect(pickRevealRemarkIndex(null, 1)).toBe(0);
    expect(pickRevealRemarkIndex(0, 1)).toBe(0);
  });

  it('avoids repeating the last index when multiple remarks exist', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    expect(pickRevealRemarkIndex(1, 3)).not.toBe(1);

    vi.restoreAllMocks();
  });
});

describe('pickRevealRemark', () => {
  it('returns remarks for casual scores 0, 1, and 3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(
      pickRevealRemark({
        gameMode: 'casual',
        score: 0,
        lastIndex: null,
        subredditDisplayName: 'AskReddit',
      })
    ).toEqual({
      key: 'casual-0',
      index: 0,
      text: CASUAL_REVEAL_REMARKS[0][0],
    });

    expect(
      pickRevealRemark({
        gameMode: 'casual',
        score: 1,
        lastIndex: null,
        subredditDisplayName: 'AskReddit',
      })
    ).toEqual({
      key: 'casual-1',
      index: 0,
      text: CASUAL_REVEAL_REMARKS[1][0],
    });

    expect(
      pickRevealRemark({
        gameMode: 'casual',
        score: 3,
        lastIndex: null,
        subredditDisplayName: 'AskReddit',
      })
    ).toEqual({
      key: 'casual-3',
      index: 0,
      text: CASUAL_REVEAL_REMARKS[3][0],
    });

    vi.restoreAllMocks();
  });

  it('returns remarks for expert scores 0 through 3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    for (const score of [0, 1, 2, 3] as const) {
      expect(
        pickRevealRemark({
          gameMode: 'expert',
          score,
          lastIndex: null,
          subredditDisplayName: 'AskReddit',
        })
      ).toEqual({
        key: `expert-${score}`,
        index: 0,
        text: EXPERT_REVEAL_REMARKS[score][0],
      });
    }

    vi.restoreAllMocks();
  });

  it('returns null for unsupported scores', () => {
    expect(
      pickRevealRemark({
        gameMode: 'casual',
        score: 2,
        lastIndex: null,
        subredditDisplayName: 'AskReddit',
      })
    ).toBeNull();
    expect(
      pickRevealRemark({
        gameMode: 'expert',
        score: -1,
        lastIndex: null,
        subredditDisplayName: 'AskReddit',
      })
    ).toBeNull();
  });

  it('returns forfeit remarks when forfeited', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(
      pickRevealRemark({
        gameMode: 'casual',
        score: 0,
        lastIndex: null,
        subredditDisplayName: 'AskReddit',
        forfeited: true,
      })
    ).toEqual({
      key: 'casual-forfeit',
      index: 0,
      text: FORFEIT_REVEAL_REMARKS[0],
    });

    vi.restoreAllMocks();
  });
});

describe('pickSkipRevealRemark', () => {
  it('returns one of the skip reveal remarks', () => {
    const remark = pickSkipRevealRemark();
    expect(SKIP_REVEAL_REMARKS).toContain(remark);
  });
});

describe('resolveCasualSlotHighlight', () => {
  it('marks only the top slot correct on a perfect pick', () => {
    expect(resolveCasualSlotHighlight(0, { correct: true }, 3)).toBe('correct');
    expect(resolveCasualSlotHighlight(1, { correct: false }, 3)).toBe('neutral');
    expect(resolveCasualSlotHighlight(2, { correct: false }, 3)).toBe('neutral');
  });

  it('marks only the middle slot incorrect on a #2 pick', () => {
    expect(resolveCasualSlotHighlight(0, { correct: false }, 1)).toBe('neutral');
    expect(resolveCasualSlotHighlight(1, { correct: false }, 1)).toBe('incorrect');
    expect(resolveCasualSlotHighlight(2, { correct: false }, 1)).toBe('neutral');
  });

  it('marks only the bottom slot incorrect on a #3 pick', () => {
    expect(resolveCasualSlotHighlight(0, { correct: false }, 0)).toBe('neutral');
    expect(resolveCasualSlotHighlight(1, { correct: false }, 0)).toBe('neutral');
    expect(resolveCasualSlotHighlight(2, { correct: false }, 0)).toBe('incorrect');
  });

  it('marks only the top slot amber on forfeit', () => {
    expect(resolveCasualSlotHighlight(0, { correct: false }, 0, true)).toBe(
      'incorrect'
    );
    expect(resolveCasualSlotHighlight(1, { correct: false }, 0, true)).toBe(
      'neutral'
    );
    expect(resolveCasualSlotHighlight(2, { correct: false }, 0, true)).toBe(
      'neutral'
    );
  });

  it('marks all slots neutral on skip reveal', () => {
    expect(
      resolveCasualSlotHighlight(0, { correct: true }, 0, false, true)
    ).toBe('neutral');
    expect(
      resolveCasualSlotHighlight(1, { correct: true }, 0, false, true)
    ).toBe('neutral');
    expect(
      resolveCasualSlotHighlight(2, { correct: true }, 0, false, true)
    ).toBe('neutral');
  });
});
