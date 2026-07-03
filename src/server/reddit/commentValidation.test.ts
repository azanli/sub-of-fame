import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Comment } from '@devvit/reddit/models/Comment.js';
import type { NextWorkBudget } from '../../shared/api.js';
import type { PuzzleSnapshot } from '../redis/types.js';

const { mockGetSnapshot, mockSetSnapshot, mockGetComments } = vi.hoisted(() => ({
  mockGetSnapshot: vi.fn(),
  mockSetSnapshot: vi.fn(),
  mockGetComments: vi.fn(),
}));

vi.mock('../redis/snapshotStore.js', () => ({
  getSnapshot: mockGetSnapshot,
  setSnapshot: mockSetSnapshot,
}));

const {
  deduplicateById,
  hasDistinctScores,
  isAuthorValid,
  isBodyValid,
  isNotModerationContent,
  isScoreValid,
  isTopLevel,
  normalizeBody,
  validateComments,
} = await import('./commentValidation.js');

const SOURCE_POST_ID = 't3_abc123';
const POST_BODY = 'This is a long enough post body for the puzzle snapshot.';

const baseCommentData = {
  author: 'testuser',
  subreddit: 'gaming',
  subredditId: 't5_gaming',
  linkId: 't3_abc123',
  parentId: SOURCE_POST_ID,
  permalink: '/r/gaming/comments/abc123/title/comment/xyz/',
  createdUtc: 1_700_000_000,
};

const makeComment = (
  overrides: Partial<{
    id: string;
    body: string;
    author: string;
    parentId: string;
    score: number;
    stickied: boolean;
    distinguished: string;
    removed: boolean;
  }> = {}
): Comment =>
  new Comment({
    ...baseCommentData,
    id: 'comment1',
    body: 'This is a valid comment body with enough visible characters.',
    score: 100,
    ...overrides,
  });

const makeBudget = (overrides: Partial<NextWorkBudget> = {}): NextWorkBudget => ({
  redditCallsRemaining: 12,
  softDeadlineAt: Date.now() + 60_000,
  itemsCheckedRemaining: 20,
  ...overrides,
});

const makeListing = (comments: Comment[]) => ({
  get: vi.fn().mockResolvedValue(comments),
});

const validateParams = (
  overrides: Partial<{
    title: string;
    body?: string;
    imageUrl?: string;
    galleryUrls?: string[];
    numberOfComments: number;
  }> = {}
) => ({
  sourcePostId: SOURCE_POST_ID,
  post: {
    title: 'Test post title',
    body: POST_BODY,
    imageUrl: 'https://example.com/image.jpg',
    ...overrides,
  },
  numberOfComments: overrides.numberOfComments ?? 42,
});

const toClientComments = (snapshot: PuzzleSnapshot) =>
  snapshot.comments.map(({ id, body }) => ({ id, body }));

beforeEach(() => {
  mockGetSnapshot.mockReset();
  mockSetSnapshot.mockReset();
  mockGetComments.mockReset();
  mockGetSnapshot.mockResolvedValue(null);
  mockSetSnapshot.mockResolvedValue(undefined);
});

describe('normalizeBody', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeBody('  hello   world  ')).toBe('hello world');
  });
});

describe('isTopLevel', () => {
  it('returns true when parentId matches sourcePostId', () => {
    expect(isTopLevel(makeComment(), SOURCE_POST_ID)).toBe(true);
  });

  it('returns false when parentId is a comment id', () => {
    expect(isTopLevel(makeComment({ parentId: 't1_parent' }), SOURCE_POST_ID)).toBe(false);
  });
});

describe('isBodyValid', () => {
  it('rejects empty and short bodies', () => {
    expect(isBodyValid('')).toBe(false);
    expect(isBodyValid('too short')).toBe(false);
  });

  it('rejects deleted and removed sentinels case-insensitively', () => {
    expect(isBodyValid('[deleted]')).toBe(false);
    expect(isBodyValid('[DELETED]')).toBe(false);
    expect(isBodyValid('[removed]')).toBe(false);
    expect(isBodyValid('[Removed]')).toBe(false);
  });

  it('accepts bodies with at least 20 visible characters', () => {
    expect(isBodyValid('abcdefghijklmnopqrst')).toBe(true);
  });

  it('rejects bodies longer than the configured maximum', () => {
    expect(isBodyValid('a'.repeat(181))).toBe(false);
  });

  it('accepts bodies at exactly the configured maximum length', () => {
    expect(isBodyValid('a'.repeat(180))).toBe(true);
  });
});

describe('isAuthorValid', () => {
  it('rejects AutoModerator case-insensitively', () => {
    expect(isAuthorValid('AutoModerator')).toBe(false);
    expect(isAuthorValid('automoderator')).toBe(false);
  });

  it('accepts ordinary authors', () => {
    expect(isAuthorValid('testuser')).toBe(true);
  });
});

describe('isNotModerationContent', () => {
  it('rejects stickied comments', () => {
    expect(isNotModerationContent(makeComment({ stickied: true }))).toBe(false);
  });

  it('rejects distinguished comments', () => {
    expect(isNotModerationContent(makeComment({ distinguished: 'moderator' }))).toBe(false);
  });

  it('accepts ordinary user comments', () => {
    expect(isNotModerationContent(makeComment())).toBe(true);
  });
});

describe('isScoreValid', () => {
  it('rejects undefined, NaN, and Infinity', () => {
    expect(isScoreValid(undefined)).toBe(false);
    expect(isScoreValid(Number.NaN)).toBe(false);
    expect(isScoreValid(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('accepts negative and zero scores', () => {
    expect(isScoreValid(0)).toBe(true);
    expect(isScoreValid(-5)).toBe(true);
  });
});

describe('hasDistinctScores', () => {
  it('returns false when selected top three contain a tie', () => {
    expect(
      hasDistinctScores([
        { id: 'a', body: 'a', score: 100, createdAt: 1 },
        { id: 'b', body: 'b', score: 50, createdAt: 2 },
        { id: 'c', body: 'c', score: 50, createdAt: 3 },
      ])
    ).toBe(false);
  });

  it('returns true when all three scores are distinct', () => {
    expect(
      hasDistinctScores([
        { id: 'a', body: 'a', score: 100, createdAt: 1 },
        { id: 'b', body: 'b', score: 50, createdAt: 2 },
        { id: 'c', body: 'c', score: 25, createdAt: 3 },
      ])
    ).toBe(true);
  });
});

describe('deduplicateById', () => {
  it('keeps the first occurrence of duplicate comment ids', () => {
    const first = makeComment({ id: 'dup', body: 'First duplicate comment body text.' });
    const second = makeComment({ id: 'dup', body: 'Second duplicate comment body text.' });
    const unique = makeComment({ id: 'unique', body: 'Unique comment body text here.' });

    const result = deduplicateById([first, second, unique]);
    expect(result).toHaveLength(2);
    expect(result[0]?.body).toBe('First duplicate comment body text.');
  });
});

describe('validateComments – cached snapshot', () => {
  it('returns valid without calling reddit when snapshot exists', async () => {
    const cached: PuzzleSnapshot = {
      sourcePostId: SOURCE_POST_ID,
      post: { title: 'Cached post' },
      numberOfComments: 30,
      comments: [
        { id: 't1_1', body: 'First cached comment body text.', score: 100, createdAt: 1 },
        { id: 't1_2', body: 'Second cached comment body text.', score: 50, createdAt: 2 },
        { id: 't1_3', body: 'Third cached comment body text.', score: 25, createdAt: 3 },
      ],
      createdAt: 1000,
      expiresAt: 2000,
    };
    mockGetSnapshot.mockResolvedValue(cached);

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result).toEqual({
      kind: 'valid',
      snapshot: {
        ...cached,
        post: {
          title: 'Cached post',
          body: POST_BODY,
          imageUrl: 'https://example.com/image.jpg',
        },
        numberOfComments: 30,
      },
    });
    expect(mockGetComments).not.toHaveBeenCalled();
    expect(mockSetSnapshot).not.toHaveBeenCalled();
  });

  it('merges galleryUrls from fresh post data into a cached snapshot', async () => {
    const cached: PuzzleSnapshot = {
      sourcePostId: SOURCE_POST_ID,
      post: {
        title: 'Cached post',
        imageUrl: 'https://example.com/first.jpg',
      },
      numberOfComments: 30,
      comments: [
        { id: 't1_1', body: 'First cached comment body text.', score: 100, createdAt: 1 },
        { id: 't1_2', body: 'Second cached comment body text.', score: 50, createdAt: 2 },
        { id: 't1_3', body: 'Third cached comment body text.', score: 25, createdAt: 3 },
      ],
      createdAt: 1000,
      expiresAt: 2000,
    };
    mockGetSnapshot.mockResolvedValue(cached);

    const galleryUrls = [
      'https://example.com/one.jpg',
      'https://example.com/two.jpg',
      'https://example.com/three.jpg',
    ];
    const reddit = { getComments: mockGetComments };
    const result = await validateComments(
      validateParams({
        galleryUrls,
        imageUrl: galleryUrls[0],
      }),
      reddit,
      makeBudget()
    );

    expect(result).toEqual({
      kind: 'valid',
      snapshot: {
        ...cached,
        post: {
          title: 'Cached post',
          body: POST_BODY,
          imageUrl: galleryUrls[0],
          galleryUrls,
        },
        numberOfComments: 30,
      },
    });
  });
});

describe('validateComments – budget exhaustion', () => {
  it('returns unplayable without calling reddit when budget is exhausted', async () => {
    const reddit = { getComments: mockGetComments };
    const result = await validateComments(
      validateParams(),
      reddit,
      makeBudget({ redditCallsRemaining: 0 })
    );

    expect(result).toEqual({ kind: 'unplayable' });
    expect(mockGetComments).not.toHaveBeenCalled();
    expect(mockSetSnapshot).not.toHaveBeenCalled();
  });
});

describe('validateComments – fewer than three valid roots', () => {
  it('returns invalid when reddit returns too few valid comments', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result).toEqual({ kind: 'invalid' });
    expect(mockSetSnapshot).not.toHaveBeenCalled();
  });
});

describe('validateComments – valid snapshot', () => {
  it('returns valid with true rank order and persists the snapshot', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c3', score: 25 }),
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const budget = makeBudget();
    const result = await validateComments(validateParams(), reddit, budget);

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c1', 't1_c2', 't1_c3']);
    expect(result.snapshot.comments.map((comment) => comment.score)).toEqual([100, 50, 25]);
    expect(result.snapshot.post).toEqual({
      title: 'Test post title',
      body: POST_BODY,
      imageUrl: 'https://example.com/image.jpg',
    });
    expect(mockSetSnapshot).toHaveBeenCalledTimes(1);
    expect(mockSetSnapshot).toHaveBeenCalledWith(SOURCE_POST_ID, result.snapshot);
    expect(budget.redditCallsRemaining).toBe(11);
  });
});

describe('validateComments – tie among selected top three', () => {
  it('returns invalid when the top three scores contain a tie', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50 }),
        makeComment({ id: 'c3', score: 50 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result).toEqual({ kind: 'invalid' });
    expect(mockSetSnapshot).not.toHaveBeenCalled();
  });
});

describe('validateComments – tie outside selected top three', () => {
  it('returns valid when only the fourth score ties', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50 }),
        makeComment({ id: 'c3', score: 25 }),
        makeComment({ id: 'c4', score: 25 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.score)).toEqual([100, 50, 25]);
    expect(mockSetSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe('validateComments – depth leakage', () => {
  it('filters out replies whose parentId is not the source post', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50, parentId: 't1_parent' }),
        makeComment({ id: 'c3', score: 25 }),
        makeComment({ id: 'c4', score: 10 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c1', 't1_c3', 't1_c4']);
  });
});

describe('validateComments – deleted body sentinels', () => {
  it('rejects comments whose normalized body is a deleted or removed sentinel', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50, body: '[deleted]' }),
        makeComment({ id: 'c3', score: 25, body: '  [REMOVED]  ' }),
        makeComment({ id: 'c4', score: 10 }),
        makeComment({ id: 'c5', score: 5 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c1', 't1_c4', 't1_c5']);
  });
});

describe('validateComments – empty body after normalization', () => {
  it('returns invalid when valid-looking comments are too short after normalization', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, body: '   ' }),
        makeComment({ id: 'c2', score: 50 }),
        makeComment({ id: 'c3', score: 25 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result).toEqual({ kind: 'invalid' });
  });
});

describe('validateComments – AutoModerator', () => {
  it('rejects AutoModerator comments case-insensitively', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50, author: 'automoderator' }),
        makeComment({ id: 'c3', score: 25 }),
        makeComment({ id: 'c4', score: 10 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c1', 't1_c3', 't1_c4']);
  });
});

describe('validateComments – stickied and distinguished', () => {
  it('rejects stickied and distinguished moderation comments', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50, stickied: true }),
        makeComment({ id: 'c3', score: 25, distinguished: 'moderator' }),
        makeComment({ id: 'c4', score: 10 }),
        makeComment({ id: 'c5', score: 5 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c1', 't1_c4', 't1_c5']);
  });
});

describe('validateComments – non-numeric scores', () => {
  it('rejects comments with NaN scores', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: Number.NaN }),
        makeComment({ id: 'c3', score: 25 }),
        makeComment({ id: 'c4', score: 10 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c1', 't1_c3', 't1_c4']);
  });
});

describe('validateComments – zero and negative scores', () => {
  it('accepts zero and negative scores when they are distinct', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 0 }),
        makeComment({ id: 'c2', score: -1 }),
        makeComment({ id: 'c3', score: -5 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.score)).toEqual([0, -1, -5]);
  });
});

describe('validateComments – duplicate comment ids', () => {
  it('de-duplicates duplicate ids before selecting the top three', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'dup', score: 100, body: 'First duplicate comment body text.' }),
        makeComment({ id: 'dup', score: 90, body: 'Second duplicate comment body text.' }),
        makeComment({ id: 'c2', score: 50 }),
        makeComment({ id: 'c3', score: 25 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_dup', 't1_c2', 't1_c3']);
    expect(result.snapshot.comments[0]?.body).toBe('First duplicate comment body text.');
  });
});

describe('validateComments – getComments call shape', () => {
  it('fetches top-level comments with the bounded contract options', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50 }),
        makeComment({ id: 'c3', score: 25 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    await validateComments(validateParams(), reddit, makeBudget());

    expect(mockGetComments).toHaveBeenCalledWith({
      postId: SOURCE_POST_ID,
      sort: 'top',
      depth: 1,
      limit: 25,
      pageSize: 25,
    });
  });
});

describe('validateComments – client-facing shape', () => {
  it('does not expose scores in the PuzzleNextResponse-facing comment shape', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50 }),
        makeComment({ id: 'c3', score: 25 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    const clientComments = toClientComments(result.snapshot);
    expect(clientComments).toEqual([
      { id: 't1_c1', body: 'This is a valid comment body with enough visible characters.' },
      { id: 't1_c2', body: 'This is a valid comment body with enough visible characters.' },
      { id: 't1_c3', body: 'This is a valid comment body with enough visible characters.' },
    ]);
    for (const comment of clientComments) {
      expect(comment).not.toHaveProperty('score');
    }
  });
});

describe('validateComments – error path', () => {
  it('returns error when reddit throws unexpectedly', async () => {
    mockGetComments.mockImplementation(() => {
      throw new Error('reddit unavailable');
    });

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') {
      return;
    }

    expect(result.cause).toBeInstanceOf(Error);
    expect(mockSetSnapshot).not.toHaveBeenCalled();
  });
});

describe('validateComments – maximum comment length', () => {
  it('skips overlong comments and selects the next eligible roots', async () => {
    const shortBody = 'This is a valid comment body with enough visible characters.';
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, body: 'a'.repeat(181) }),
        makeComment({ id: 'c2', score: 50, body: shortBody }),
        makeComment({ id: 'c3', score: 25, body: shortBody }),
        makeComment({ id: 'c4', score: 10, body: shortBody }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c2', 't1_c3', 't1_c4']);
  });

  it('returns invalid when fewer than three comments fit within the maximum length', async () => {
    const shortBody = 'This is a valid comment body with enough visible characters.';
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, body: 'a'.repeat(181) }),
        makeComment({ id: 'c2', score: 50, body: shortBody }),
        makeComment({ id: 'c3', score: 25, body: 'b'.repeat(181) }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('invalid');
  });
});

describe('validateComments – removed flag', () => {
  it('rejects comments marked removed even when the body looks valid', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50, removed: true }),
        makeComment({ id: 'c3', score: 25 }),
        makeComment({ id: 'c4', score: 10 }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c1', 't1_c3', 't1_c4']);
  });
});
