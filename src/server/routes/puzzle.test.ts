import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../trpc';
import type { PuzzleSnapshot } from '../redis/types';

const {
  mockResolveSubredditMetadata,
  mockResolveLadderPage,
  mockFastFilterEligible,
  mockValidateComments,
  mockGetProgress,
  mockIncrementProgress,
  mockSetAttempt,
} = vi.hoisted(() => ({
  mockResolveSubredditMetadata: vi.fn(),
  mockResolveLadderPage: vi.fn(),
  mockFastFilterEligible: vi.fn(),
  mockValidateComments: vi.fn(),
  mockGetProgress: vi.fn(),
  mockIncrementProgress: vi.fn(),
  mockSetAttempt: vi.fn(),
}));

vi.mock('../reddit/resolveSubredditMetadata.js', () => ({
  resolveSubredditMetadata: mockResolveSubredditMetadata,
}));

vi.mock('../reddit/ladderPipeline.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../reddit/ladderPipeline.js')>();
  return {
    ...original,
    resolveLadderPage: mockResolveLadderPage,
    fastFilterEligible: mockFastFilterEligible,
  };
});

vi.mock('../reddit/commentValidation.js', () => ({
  validateComments: mockValidateComments,
}));

vi.mock('../redis/progressStore.js', () => ({
  getProgress: mockGetProgress,
  incrementProgress: mockIncrementProgress,
  setProgress: vi.fn(),
  getAllProgress: vi.fn(),
}));

vi.mock('../redis/attemptStore.js', () => ({
  setAttempt: mockSetAttempt,
}));

const { appRouter } = await import('../appRouter.js');
const { createCallerFactory } = await import('../trpc.js');

const createCaller = createCallerFactory(appRouter);

const curatedMetadata = {
  subreddit: 'askreddit',
  displayName: 'AskReddit',
  iconUrl: 'https://example.com/askreddit.png',
  metadataSource: 'curated' as const,
};

const makeCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  reddit: {
    getSubredditInfoByName: vi.fn(),
    getSubredditStyles: vi.fn(),
    getTopPosts: vi.fn(),
    getComments: vi.fn(),
  },
  userId: undefined,
  subredditName: 'suboffame',
  surface: 'profile',
  ...overrides,
});

const makePostSummary = () => ({
  id: 't3_abc123',
  title: 'A long enough post title for the puzzle',
  hasBody: false,
  isNSFW: false,
  isSpoiler: false,
  commentCount: 42,
  imageUrl: 'https://example.com/image.jpg',
});

const makeLadderHit = (post = makePostSummary()) => ({
  kind: 'hit' as const,
  page: {
    page: 1,
    startsAfter: null,
    nextAfter: 'cursor-1',
    posts: [post],
    fetchedAt: Date.now(),
  },
  offset: 0,
});

const makeSnapshot = (): PuzzleSnapshot => ({
  sourcePostId: 't3_abc123',
  post: {
    title: 'A long enough post title for the puzzle',
    imageUrl: 'https://example.com/image.jpg',
  },
  comments: [
    {
      id: 't1_c1',
      body: 'First valid comment body with enough visible characters.',
      score: 100,
      createdAt: 1,
    },
    {
      id: 't1_c2',
      body: 'Second valid comment body with enough visible characters.',
      score: 50,
      createdAt: 2,
    },
    {
      id: 't1_c3',
      body: 'Third valid comment body with enough visible characters.',
      score: 25,
      createdAt: 3,
    },
  ],
  createdAt: 1000,
  expiresAt: 2000,
});

describe('puzzle.next', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockResolvedValue(curatedMetadata);
    mockResolveLadderPage.mockResolvedValue(makeLadderHit());
    mockFastFilterEligible.mockReturnValue(true);
    mockValidateComments.mockResolvedValue({ kind: 'valid', snapshot: makeSnapshot() });
    mockGetProgress.mockResolvedValue(3);
    mockIncrementProgress.mockResolvedValue(4);
    mockSetAttempt.mockResolvedValue(undefined);
  });

  it('returns SUBREDDIT_REQUIRED on Hub when subreddit is omitted', async () => {
    const caller = createCaller(makeCtx());

    const result = await caller.puzzle.next({});

    expect(result).toEqual({
      status: 'error',
      code: 'SUBREDDIT_REQUIRED',
      message: 'A subreddit is required for Hub gameplay.',
    });
    expect(mockResolveSubredditMetadata).not.toHaveBeenCalled();
    expect(mockResolveLadderPage).not.toHaveBeenCalled();
  });

  it('returns HOST_SUBREDDIT_LOCKED on Community when subreddit mismatches host', async () => {
    const caller = createCaller(
      makeCtx({ subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(result).toEqual({
      status: 'error',
      code: 'HOST_SUBREDDIT_LOCKED',
      message: 'Gameplay is locked to the host community subreddit.',
    });
    expect(mockResolveLadderPage).not.toHaveBeenCalled();
  });

  it('returns SUBREDDIT_UNAVAILABLE when Hub metadata resolution fails', async () => {
    mockResolveSubredditMetadata.mockResolvedValue(null);
    const caller = createCaller(makeCtx());

    const result = await caller.puzzle.next({ subreddit: 'missing' });

    expect(result).toEqual({
      status: 'error',
      code: 'SUBREDDIT_UNAVAILABLE',
      message: 'Subreddit does not exist or is inaccessible.',
    });
    expect(mockResolveLadderPage).not.toHaveBeenCalled();
  });

  it('uses Redis progress for logged-in users and ignores request rankIndex', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    await caller.puzzle.next({ subreddit: 'askreddit', rankIndex: 99 });

    expect(mockGetProgress).toHaveBeenCalledWith('user-1', 'askreddit');
    expect(mockSetAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ rankIndex: 3 })
    );
  });

  it('uses request rankIndex for logged-out users and does not read progress', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    await caller.puzzle.next({ subreddit: 'askreddit', rankIndex: 5 });

    expect(mockGetProgress).not.toHaveBeenCalled();
    expect(mockResolveLadderPage).toHaveBeenCalledWith(
      'askreddit',
      5,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('defaults logged-out rankIndex to 1 when omitted', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(mockResolveLadderPage).toHaveBeenCalledWith(
      'askreddit',
      1,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('advances logged-in progress on fast-filter skip', async () => {
    mockFastFilterEligible.mockReturnValueOnce(false).mockReturnValue(true);
    mockResolveLadderPage
      .mockResolvedValueOnce(makeLadderHit())
      .mockResolvedValueOnce(makeLadderHit());

    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(mockIncrementProgress).toHaveBeenCalledWith('user-1', 'askreddit');
    expect(mockResolveLadderPage).toHaveBeenCalledTimes(2);
  });

  it('does not call incrementProgress for logged-out fast-filter skip', async () => {
    mockFastFilterEligible.mockReturnValueOnce(false).mockReturnValue(true);
    mockResolveLadderPage
      .mockResolvedValueOnce(makeLadderHit())
      .mockResolvedValueOnce(makeLadderHit());

    const caller = createCaller(makeCtx({ userId: undefined }));

    await caller.puzzle.next({ subreddit: 'askreddit', rankIndex: 2 });

    expect(mockIncrementProgress).not.toHaveBeenCalled();
    expect(mockResolveLadderPage).toHaveBeenNthCalledWith(
      2,
      'askreddit',
      3,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('advances logged-in progress on invalid comment validation', async () => {
    mockValidateComments
      .mockResolvedValueOnce({ kind: 'invalid' })
      .mockResolvedValueOnce({ kind: 'valid', snapshot: makeSnapshot() });

    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(mockIncrementProgress).toHaveBeenCalledWith('user-1', 'askreddit');
    expect(mockValidateComments).toHaveBeenCalledTimes(2);
  });

  it('returns unplayable when ladder resolution is budget-blocked', async () => {
    mockResolveLadderPage.mockResolvedValue({
      kind: 'unplayable',
      continuationRankIndex: 7,
    });
    const caller = createCaller(makeCtx());

    const result = await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(result.status).toBe('unplayable');
    if (result.status === 'unplayable') {
      expect(result.rankIndex).toBe(7);
    }
  });

  it('returns unplayable when comment validation is budget-blocked', async () => {
    mockValidateComments.mockResolvedValue({ kind: 'unplayable' });
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(result.status).toBe('unplayable');
    if (result.status === 'unplayable') {
      expect(result.rankIndex).toBe(3);
    }
  });

  it('returns exhausted when ladder is exhausted', async () => {
    mockResolveLadderPage.mockResolvedValue({ kind: 'exhausted' });
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'exhausted',
        rankIndex: 3,
      })
    );
  });

  it('returns ready with score-stripped comments and persists attempt', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      return;
    }

    expect(result.rankIndex).toBe(3);
    expect(result.post).toEqual({
      title: 'A long enough post title for the puzzle',
      imageUrl: 'https://example.com/image.jpg',
    });
    expect(result.comments).toHaveLength(3);
    for (const comment of result.comments) {
      expect(Object.keys(comment).sort()).toEqual(['body', 'id']);
    }

    expect(mockSetAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePostId: 't3_abc123',
        subreddit: 'askreddit',
        rankIndex: 3,
        owner: { kind: 'user', userId: 'user-1' },
        submitted: false,
        commentOrder: expect.arrayContaining(['t1_c1', 't1_c2', 't1_c3']),
      })
    );

    const attempt = mockSetAttempt.mock.calls[0]?.[0];
    expect(attempt?.commentOrder).toHaveLength(3);
    expect(result.comments.map((comment) => comment.id)).toEqual(attempt?.commentOrder);
  });

  it('freezes guest owner for logged-out ready responses', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    await caller.puzzle.next({ subreddit: 'askreddit', rankIndex: 1 });

    expect(mockSetAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { kind: 'guest' },
      })
    );
  });
});
