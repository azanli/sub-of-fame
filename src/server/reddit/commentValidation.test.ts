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
  containsUrl,
  deduplicateById,
  hasDistinctScores,
  isAuthorValid,
  isBodyValid,
  isNotModerationContent,
  isScoreValid,
  isTopLevel,
  normalizeBody,
  passesPlayabilityGates,
  passesRawTopScoreFloor,
  selectTopLevelRoots,
  takeEvaluationPool,
  validateComments,
} = await import('./commentValidation.js');

const SOURCE_POST_ID = 't3_abc123';
const POST_BODY = 'This is a long enough post body for the puzzle snapshot.';
const VALID_COMMENT_BODY = 'This is a valid comment body with enough visible characters.';
const LOW_DENSITY_BODY = 'a'.repeat(60);
const HIGH_DENSITY_BODY = 'a'.repeat(450);
const SNAPSHOT_VALIDATION_VERSION = 3;

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
    isVideo?: boolean;
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

const makeValidCachedSnapshot = (
  overrides: Partial<PuzzleSnapshot> = {}
): PuzzleSnapshot => ({
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
  rawTopScore: 100,
  threadDensityBaseline: 60,
  maxCommentLength: 500,
  validationVersion: SNAPSHOT_VALIDATION_VERSION,
  ...overrides,
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

describe('containsUrl', () => {
  it('detects http and https URLs', () => {
    expect(containsUrl('Check this out https://example.com/path for details.')).toBe(true);
    expect(containsUrl('Old link http://example.org/page')).toBe(true);
  });

  it('detects www URLs without a scheme', () => {
    expect(containsUrl('Visit www.example.com for more info today.')).toBe(true);
  });

  it('detects common Reddit short links', () => {
    expect(containsUrl('See redd.it/abc123 for the full thread context.')).toBe(true);
    expect(containsUrl('Watch youtu.be/dQw4w9WgXcQ for the clip.')).toBe(true);
  });

  it('detects Reddit image and media URLs with or without a scheme', () => {
    expect(
      containsUrl('https://preview.redd.it/photo.jpg?width=640&crop=smart&auto=webp&s=abc')
    ).toBe(true);
    expect(containsUrl('Shared image preview.redd.it/photo.jpg?width=640 here.')).toBe(true);
    expect(containsUrl('Direct link i.redd.it/abc123.png in the comment body.')).toBe(true);
    expect(containsUrl('Video clip v.redd.it/abc123 shared without a scheme.')).toBe(true);
  });

  it('detects bare reddit.com links', () => {
    expect(containsUrl('Crosspost from reddit.com/r/gaming/comments/abc123/title/')).toBe(true);
  });

  it('returns false for plain text without URLs', () => {
    expect(containsUrl('This is a valid comment body with enough visible characters.')).toBe(
      false
    );
  });
});

describe('isBodyValid', () => {
  const maxLength = 500;

  it('rejects empty and short bodies', () => {
    expect(isBodyValid('', maxLength)).toBe(false);
    expect(isBodyValid('too short', maxLength)).toBe(false);
  });

  it('rejects deleted and removed sentinels case-insensitively', () => {
    expect(isBodyValid('[deleted]', maxLength)).toBe(false);
    expect(isBodyValid('[DELETED]', maxLength)).toBe(false);
    expect(isBodyValid('[removed]', maxLength)).toBe(false);
    expect(isBodyValid('[Removed]', maxLength)).toBe(false);
  });

  it('accepts bodies with at least 16 visible characters', () => {
    expect(isBodyValid('abcdefghijklmnop', maxLength)).toBe(true);
  });

  it('rejects bodies with exactly 15 visible characters', () => {
    expect(isBodyValid('abcdefghijklmno', maxLength)).toBe(false);
  });

  it('rejects bodies longer than the provided maximum', () => {
    expect(isBodyValid('a'.repeat(501), maxLength)).toBe(false);
  });

  it('accepts bodies at exactly the provided maximum length', () => {
    expect(isBodyValid('a'.repeat(500), maxLength)).toBe(true);
  });

  it('accepts longer bodies when the dynamic maximum is higher', () => {
    expect(isBodyValid('a'.repeat(900), 1200)).toBe(true);
    expect(isBodyValid('a'.repeat(1201), 1200)).toBe(false);
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

describe('selectTopLevelRoots and takeEvaluationPool', () => {
  it('caps the evaluation pool at eight highest-scoring roots', () => {
    const roots = Array.from({ length: 12 }, (_, index) =>
      makeComment({
        id: `c${index}`,
        score: 120 - index,
        body: VALID_COMMENT_BODY,
      })
    );

    const topLevel = selectTopLevelRoots(roots, SOURCE_POST_ID);
    const pool = takeEvaluationPool(topLevel);

    expect(pool).toHaveLength(8);
    expect(pool.map((comment) => comment.score)).toEqual([120, 119, 118, 117, 116, 115, 114, 113]);
  });

  it('returns fewer than eight roots when the post has fewer top-level comments', () => {
    const roots = Array.from({ length: 5 }, (_, index) =>
      makeComment({
        id: `c${index}`,
        score: 50 - index,
        body: VALID_COMMENT_BODY,
      })
    );

    const pool = takeEvaluationPool(selectTopLevelRoots(roots, SOURCE_POST_ID));
    expect(pool).toHaveLength(5);
  });

  it('excludes replies before building the evaluation pool', () => {
    const roots = Array.from({ length: 10 }, (_, index) =>
      makeComment({
        id: `root${index}`,
        score: 100 - index,
        body: VALID_COMMENT_BODY,
      })
    );
    const replies = Array.from({ length: 3 }, (_, index) =>
      makeComment({
        id: `reply${index}`,
        score: 500 - index,
        parentId: 't1_parent',
        body: VALID_COMMENT_BODY,
      })
    );

    const pool = takeEvaluationPool(
      selectTopLevelRoots([...replies, ...roots], SOURCE_POST_ID)
    );

    expect(pool).toHaveLength(8);
    expect(pool.every((comment) => comment.parentId === SOURCE_POST_ID)).toBe(true);
  });
});

describe('passesRawTopScoreFloor and passesPlayabilityGates', () => {
  it('requires the raw top root to meet the minimum score floor', () => {
    expect(passesRawTopScoreFloor(makeComment({ score: 50 }))).toBe(true);
    expect(passesRawTopScoreFloor(makeComment({ score: 49 }))).toBe(false);
    expect(passesRawTopScoreFloor(makeComment({ score: Number.NaN }))).toBe(false);
  });

  it('requires three distinct scores for playability', () => {
    expect(
      passesPlayabilityGates([
        { id: 'a', body: 'a', score: 100, createdAt: 1 },
        { id: 'b', body: 'b', score: 50, createdAt: 2 },
        { id: 'c', body: 'c', score: 25, createdAt: 3 },
      ])
    ).toBe(true);
    expect(
      passesPlayabilityGates([
        { id: 'a', body: 'a', score: 100, createdAt: 1 },
        { id: 'b', body: 'b', score: 50, createdAt: 2 },
        { id: 'c', body: 'c', score: 50, createdAt: 3 },
      ])
    ).toBe(false);
  });
});

describe('validateComments – cached snapshot', () => {
  it('returns valid without calling reddit when snapshot exists', async () => {
    const cached = makeValidCachedSnapshot();
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
    const cached = makeValidCachedSnapshot({
      post: {
        title: 'Cached post',
        imageUrl: 'https://example.com/first.jpg',
      },
    });
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

  it('merges isVideo from fresh post data into a cached snapshot', async () => {
    const cached = makeValidCachedSnapshot({
      post: {
        title: 'Cached post',
        imageUrl: 'https://example.com/thumb.jpg',
      },
    });
    mockGetSnapshot.mockResolvedValue(cached);

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(
      validateParams({
        imageUrl: 'https://v.redd.it/abc123/DASH_1080.mp4?source=fallback',
        isVideo: true,
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
          imageUrl: 'https://v.redd.it/abc123/DASH_1080.mp4?source=fallback',
          isVideo: true,
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
    expect(result.snapshot.rawTopScore).toBe(100);
    expect(result.snapshot.threadDensityBaseline).toBe(60);
    expect(result.snapshot.maxCommentLength).toBe(500);
    expect(result.snapshot.validationVersion).toBe(SNAPSHOT_VALIDATION_VERSION);
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
        makeComment({ id: 'anchor', score: 60, author: 'automoderator' }),
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

describe('validateComments – adaptive maximum comment length', () => {
  it('skips overlong comments in low-density threads and selects shorter survivors', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, body: 'a'.repeat(600) }),
        makeComment({ id: 'c2', score: 50, body: LOW_DENSITY_BODY }),
        makeComment({ id: 'c3', score: 25, body: LOW_DENSITY_BODY }),
        makeComment({ id: 'c4', score: 10, body: LOW_DENSITY_BODY }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.maxCommentLength).toBe(500);
    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c2', 't1_c3', 't1_c4']);
  });

  it('accepts long comments in high-density threads up to the 1200-character ceiling', async () => {
    const longBody = 'a'.repeat(900);
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, body: longBody }),
        makeComment({ id: 'c2', score: 50, body: HIGH_DENSITY_BODY }),
        makeComment({ id: 'c3', score: 25, body: HIGH_DENSITY_BODY }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.maxCommentLength).toBe(1200);
    expect(result.snapshot.comments[0]?.body).toBe(longBody);
  });

  it('returns invalid when fewer than three comments fit within the dynamic maximum', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, body: 'a'.repeat(600) }),
        makeComment({ id: 'c2', score: 90, body: LOW_DENSITY_BODY }),
        makeComment({ id: 'c3', score: 80, body: LOW_DENSITY_BODY }),
        makeComment({ id: 'c4', score: 70, author: 'automoderator', body: LOW_DENSITY_BODY }),
        makeComment({ id: 'c5', score: 60, stickied: true, body: LOW_DENSITY_BODY }),
        makeComment({ id: 'c6', score: 50, body: 'too short' }),
        makeComment({
          id: 'c7',
          score: 40,
          body: 'Another short comment with a link https://example.com/path here.',
        }),
        makeComment({ id: 'c8', score: 30, body: '[deleted]' }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('invalid');
    if (result.kind !== 'invalid') {
      return;
    }

    expect(result).toEqual({ kind: 'invalid' });
  });
});

describe('validateComments – comments with URLs', () => {
  it('skips comments containing URLs and selects the next eligible roots', async () => {
    const shortBody = 'This is a valid comment body with enough visible characters.';
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({
          id: 'c1',
          score: 100,
          body: 'Top comment with a link https://example.com/article in the middle.',
        }),
        makeComment({ id: 'c2', score: 50, body: shortBody }),
        makeComment({
          id: 'c3',
          score: 25,
          body: 'Another one at www.example.com/path for reference here.',
        }),
        makeComment({ id: 'c4', score: 10, body: shortBody }),
        makeComment({ id: 'c5', score: 5, body: shortBody }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c2', 't1_c4', 't1_c5']);
  });

  it('returns invalid when fewer than three comments remain after URL filtering', async () => {
    const shortBody = 'This is a valid comment body with enough visible characters.';
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({
          id: 'c1',
          score: 100,
          body: 'First link https://example.com/one in the comment body here.',
        }),
        makeComment({ id: 'c2', score: 50, body: shortBody }),
        makeComment({
          id: 'c3',
          score: 25,
          body: 'Second link www.example.com/two in the comment body here.',
        }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(result).toEqual({ kind: 'invalid' });
  });

  it('filters bare preview.redd.it links without a scheme', async () => {
    const shortBody = 'This is a valid comment body with enough visible characters.';
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({
          id: 'c1',
          score: 100,
          body: 'Image dump preview.redd.it/photo.jpg?width=640 in this comment text.',
        }),
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
});

describe('validateComments – cached snapshot with URL comments', () => {
  it('re-fetches comments when a cached snapshot contains URLs', async () => {
    const shortBody = 'This is a valid comment body with enough visible characters.';
    const cached: PuzzleSnapshot = {
      sourcePostId: SOURCE_POST_ID,
      post: { title: 'Cached post' },
      numberOfComments: 30,
      comments: [
        {
          id: 't1_1',
          body: 'Cached comment with https://preview.redd.it/old.png in it.',
          score: 100,
          createdAt: 1,
        },
        { id: 't1_2', body: 'Second cached comment body text.', score: 50, createdAt: 2 },
        { id: 't1_3', body: 'Third cached comment body text.', score: 25, createdAt: 3 },
      ],
      createdAt: 1000,
      expiresAt: 2000,
    };
    mockGetSnapshot.mockResolvedValue(cached);
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, body: shortBody }),
        makeComment({ id: 'c2', score: 50, body: shortBody }),
        makeComment({ id: 'c3', score: 25, body: shortBody }),
      ])
    );

    const reddit = { getComments: mockGetComments };
    const result = await validateComments(validateParams(), reddit, makeBudget());

    expect(mockGetComments).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual(['t1_c1', 't1_c2', 't1_c3']);
    expect(mockSetSnapshot).toHaveBeenCalledTimes(1);
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

describe('validateComments – evaluation pool semantics', () => {
  const shortNoise = 'too short';

  it('returns invalid when only two valid comments survive within the top eight', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        ...Array.from({ length: 6 }, (_, index) =>
          makeComment({
            id: `noise${index}`,
            score: 90 - index,
            body: shortNoise,
          })
        ),
        makeComment({ id: 'long7', score: 20, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'long8', score: 15, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'long9', score: 10, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'long10', score: 5, body: VALID_COMMENT_BODY }),
      ])
    );

    const result = await validateComments(
      validateParams(),
      { getComments: mockGetComments },
      makeBudget()
    );

    expect(result).toEqual({ kind: 'invalid' });
  });

  it('selects valid comments buried at ranks six through eight in the pool', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, author: 'automoderator' }),
        makeComment({ id: 'c2', score: 90, body: shortNoise }),
        makeComment({ id: 'c3', score: 80, body: 'link https://example.com/path here.' }),
        makeComment({ id: 'c4', score: 70, stickied: true }),
        makeComment({ id: 'c5', score: 60, body: shortNoise }),
        makeComment({ id: 'c6', score: 50, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'c7', score: 40, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'c8', score: 30, body: VALID_COMMENT_BODY }),
      ])
    );

    const result = await validateComments(
      validateParams(),
      { getComments: mockGetComments },
      makeBudget()
    );

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual([
      't1_c6',
      't1_c7',
      't1_c8',
    ]);
  });

  it('returns invalid when three valid comments exist only outside the top eight pool', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        ...Array.from({ length: 8 }, (_, index) =>
          makeComment({
            id: `blocked${index}`,
            score: 100 - index,
            body: shortNoise,
          })
        ),
        makeComment({ id: 'valid9', score: 10, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'valid10', score: 9, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'valid11', score: 8, body: VALID_COMMENT_BODY }),
      ])
    );

    const result = await validateComments(
      validateParams(),
      { getComments: mockGetComments },
      makeBudget()
    );

    expect(result).toEqual({ kind: 'invalid' });
  });
});

describe('validateComments – raw top score floor', () => {
  it('returns invalid when raw number one is below the upvote floor', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 30, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'c2', score: 29, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'c3', score: 28, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'c4', score: 27, body: VALID_COMMENT_BODY }),
      ])
    );

    const result = await validateComments(
      validateParams(),
      { getComments: mockGetComments },
      makeBudget()
    );

    expect(result).toEqual({ kind: 'invalid' });
    expect(mockSetSnapshot).not.toHaveBeenCalled();
  });

  it('returns valid when raw number one passes the floor but is filtered from the game', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 1000, author: 'automoderator' }),
        makeComment({ id: 'c2', score: 200, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'c3', score: 150, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'c4', score: 100, body: VALID_COMMENT_BODY }),
      ])
    );

    const result = await validateComments(
      validateParams(),
      { getComments: mockGetComments },
      makeBudget()
    );

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.rawTopScore).toBe(1000);
    expect(result.snapshot.comments.map((comment) => comment.id)).toEqual([
      't1_c2',
      't1_c3',
      't1_c4',
    ]);
  });
});

describe('validateComments – length boundaries in pool', () => {
  it('accepts a sixteen-character comment in the pool', async () => {
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, body: 'abcdefghijklmnop' }),
        makeComment({ id: 'c2', score: 50, body: VALID_COMMENT_BODY }),
        makeComment({ id: 'c3', score: 25, body: VALID_COMMENT_BODY }),
      ])
    );

    const result = await validateComments(
      validateParams(),
      { getComments: mockGetComments },
      makeBudget()
    );

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments[0]?.body).toBe('abcdefghijklmnop');
  });

  it('accepts a nine-hundred-character comment in a high-density thread', async () => {
    const longBody = 'a'.repeat(900);
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100, body: longBody }),
        makeComment({ id: 'c2', score: 50, body: HIGH_DENSITY_BODY }),
        makeComment({ id: 'c3', score: 25, body: HIGH_DENSITY_BODY }),
      ])
    );

    const result = await validateComments(
      validateParams(),
      { getComments: mockGetComments },
      makeBudget()
    );

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.comments[0]?.body).toBe(longBody);
  });
});

describe('validateComments – stale cached snapshots', () => {
  it('re-fetches comments when cached validationVersion is stale', async () => {
    const cached = makeValidCachedSnapshot({ validationVersion: 2 });
    mockGetSnapshot.mockResolvedValue(cached);
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50 }),
        makeComment({ id: 'c3', score: 25 }),
      ])
    );

    const result = await validateComments(
      validateParams(),
      { getComments: mockGetComments },
      makeBudget()
    );

    expect(mockGetComments).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.validationVersion).toBe(SNAPSHOT_VALIDATION_VERSION);
    expect(mockSetSnapshot).toHaveBeenCalledTimes(1);
  });

  it('re-fetches comments when cached rawTopScore is missing', async () => {
    const cached = makeValidCachedSnapshot({ rawTopScore: undefined });
    mockGetSnapshot.mockResolvedValue(cached);
    mockGetComments.mockReturnValue(
      makeListing([
        makeComment({ id: 'c1', score: 100 }),
        makeComment({ id: 'c2', score: 50 }),
        makeComment({ id: 'c3', score: 25 }),
      ])
    );

    const result = await validateComments(
      validateParams(),
      { getComments: mockGetComments },
      makeBudget()
    );

    expect(mockGetComments).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') {
      return;
    }

    expect(result.snapshot.rawTopScore).toBe(100);
    expect(mockSetSnapshot).toHaveBeenCalledTimes(1);
  });
});
