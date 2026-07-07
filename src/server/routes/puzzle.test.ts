import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../trpc';
import type { PuzzleAttempt, PuzzleSnapshot } from '../redis/types';

const {
  mockResolveSubredditMetadata,
  mockResolveLadderPage,
  mockFastFilterEligible,
  mockValidateComments,
  mockGetProgress,
  mockIncrementProgress,
  mockSetAttempt,
  mockGetAttempt,
  mockMarkAttemptSubmitted,
  mockGetSnapshot,
  mockAcquireSubmitLock,
  mockIncrementStats,
  mockGetStats,
  mockGetGameMode,
  mockUpdateLeaderboard,
  mockDeductCoin,
} = vi.hoisted(() => ({
  mockResolveSubredditMetadata: vi.fn(),
  mockResolveLadderPage: vi.fn(),
  mockFastFilterEligible: vi.fn(),
  mockValidateComments: vi.fn(),
  mockGetProgress: vi.fn(),
  mockIncrementProgress: vi.fn(),
  mockSetAttempt: vi.fn(),
  mockGetAttempt: vi.fn(),
  mockMarkAttemptSubmitted: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockAcquireSubmitLock: vi.fn(),
  mockIncrementStats: vi.fn(),
  mockGetStats: vi.fn(),
  mockGetGameMode: vi.fn(),
  mockUpdateLeaderboard: vi.fn(),
  mockDeductCoin: vi.fn(),
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

const askredditAllCtx = { subredditName: 'askreddit', timeframe: 'all' as const };
const dailyChallengeCtx = { subredditName: 'all', timeframe: 'all' as const };

vi.mock('../redis/rankProgress.js', () => ({
  getRankIndex: mockGetProgress,
  advanceRankIndex: mockIncrementProgress,
  setRankIndex: vi.fn(),
}));

vi.mock('../redis/attemptStore.js', () => ({
  setAttempt: mockSetAttempt,
  getAttempt: mockGetAttempt,
  markAttemptSubmitted: mockMarkAttemptSubmitted,
}));

vi.mock('../redis/snapshotStore.js', () => ({
  getSnapshot: mockGetSnapshot,
}));

vi.mock('../redis/submitLockStore.js', () => ({
  acquireSubmitLock: mockAcquireSubmitLock,
}));

vi.mock('../redis/statsStore.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../redis/statsStore.js')>();
  return {
    ...original,
    incrementStats: mockIncrementStats,
    getStats: mockGetStats,
    getGameMode: mockGetGameMode,
    deductCoin: mockDeductCoin,
  };
});

vi.mock('../redis/leaderboardStore.js', () => ({
  updateLeaderboard: mockUpdateLeaderboard,
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
    getPostById: vi.fn(),
  },
  userId: undefined,
  subredditName: 'suboffame',
  surface: 'profile',
  ...overrides,
});

const makePostSummary = () => ({
  id: 't3_abc123',
  title: 'A long enough post title for the puzzle',
  postUrl: 'https://www.reddit.com/r/askreddit/comments/abc123/title/',
  sourceSubredditName: 'askreddit',
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
  numberOfComments: 42,
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

const makeAttempt = (overrides: Partial<PuzzleAttempt> = {}): PuzzleAttempt => ({
  attemptId: 'attempt-1',
  sourcePostId: 't3_abc123',
  subreddit: 'askreddit',
  timeframe: 'all',
  rankIndex: 3,
  owner: { kind: 'user', userId: 'user-1' },
  commentOrder: ['t1_c1', 't1_c2', 't1_c3'],
  gameMode: 'expert',
  submitted: false,
  createdAt: 1000,
  expiresAt: 9000,
  ...overrides,
});

const makeSubmitInput = (slots: [string, string, string] = ['t1_c1', 't1_c2', 't1_c3']) => ({
  gameMode: 'expert' as const,
  attemptId: 'attempt-1',
  slots,
});

const makeCasualSubmitInput = (selectedCommentId = 't1_c1') => ({
  gameMode: 'casual' as const,
  attemptId: 'attempt-1',
  selectedCommentId,
});

const makeSkipInput = () => ({
  attemptId: 'attempt-1',
});

const expectNoSubmitMutations = () => {
  expect(mockMarkAttemptSubmitted).not.toHaveBeenCalled();
  expect(mockIncrementStats).not.toHaveBeenCalled();
  expect(mockIncrementProgress).not.toHaveBeenCalled();
  expect(mockUpdateLeaderboard).not.toHaveBeenCalled();
};

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
    mockGetGameMode.mockResolvedValue('expert');
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

    expect(mockGetProgress).toHaveBeenCalledWith('user-1', askredditAllCtx);
    expect(mockSetAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ rankIndex: 3 })
    );
  });

  it('uses request rankIndex for logged-out users and does not read progress', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    await caller.puzzle.next({ subreddit: 'askreddit', rankIndex: 5 });

    expect(mockGetProgress).not.toHaveBeenCalled();
    expect(mockResolveLadderPage).toHaveBeenCalledWith(
      askredditAllCtx,
      5,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('defaults logged-out rankIndex to 1 when omitted', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(mockResolveLadderPage).toHaveBeenCalledWith(
      askredditAllCtx,
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

    expect(mockIncrementProgress).toHaveBeenCalledWith('user-1', askredditAllCtx);
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
      askredditAllCtx,
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

    expect(mockIncrementProgress).toHaveBeenCalledWith('user-1', askredditAllCtx);
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
    expect(result.subredditDisplayName).toBe('AskReddit');
    expect(result.postUrl).toBe('https://www.reddit.com/r/askreddit/comments/abc123/title/');
    expect(result.post).toEqual({
      title: 'A long enough post title for the puzzle',
      imageUrl: 'https://example.com/image.jpg',
    });
    expect(result.numberOfComments).toBe(42);
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
        gameMode: 'expert',
        commentOrder: expect.arrayContaining(['t1_c1', 't1_c2', 't1_c3']),
      })
    );

    const attempt = mockSetAttempt.mock.calls[0]?.[0];
    expect(attempt?.commentOrder).toHaveLength(3);
    expect(result.comments.map((comment) => comment.id)).toEqual(attempt?.commentOrder);
  });

  it('returns ready with isVideo passthrough for reddit-hosted video posts', async () => {
    mockResolveLadderPage.mockResolvedValue(
      makeLadderHit({
        ...makePostSummary(),
        imageUrl: 'https://v.redd.it/abc123/DASH_1080.mp4?source=fallback',
        isVideo: true,
      })
    );

    const caller = createCaller(makeCtx({ userId: 'user-1' }));
    const result = await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      return;
    }

    expect(result.post.isVideo).toBe(true);
    expect(result.post.imageUrl).toBe(
      'https://v.redd.it/abc123/DASH_1080.mp4?source=fallback'
    );
    expect(result.post.galleryUrls).toBeUndefined();
  });

  it('returns ready with the post source subreddit display name for Daily Challenge', async () => {
    mockResolveSubredditMetadata.mockImplementation(async (name: string) => {
      if (name === 'all') {
        return {
          subreddit: 'all',
          displayName: 'all',
          iconUrl: '/fame-icon.png',
          metadataSource: 'curated',
        };
      }
      if (name === 'gaming') {
        return {
          subreddit: 'gaming',
          displayName: 'Gaming',
          iconUrl: 'https://example.com/gaming.png',
          metadataSource: 'reddit',
        };
      }
      return null;
    });

    mockResolveLadderPage.mockResolvedValue(
      makeLadderHit({
        ...makePostSummary(),
        sourceSubredditName: 'gaming',
        postUrl: 'https://www.reddit.com/r/gaming/comments/abc123/title/',
      })
    );

    const caller = createCaller(makeCtx({ userId: undefined }));
    const result = await caller.puzzle.next({ subreddit: 'all', rankIndex: 1 });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      return;
    }

    expect(result.subredditDisplayName).toBe('Gaming');
    expect(result.rankIndex).toBe(1);
    expect(mockResolveSubredditMetadata).toHaveBeenCalledWith('all', expect.any(Object));
    expect(mockResolveSubredditMetadata).toHaveBeenCalledWith('gaming', expect.any(Object));
    expect(mockSetAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        subreddit: 'all',
        rankIndex: 1,
      })
    );
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

  it('mints attempts with the logged-in player stored gameMode', async () => {
    mockGetGameMode.mockResolvedValue('expert');
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    await caller.puzzle.next({ subreddit: 'askreddit' });

    expect(mockGetGameMode).toHaveBeenCalledWith('user-1');
    expect(mockSetAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ gameMode: 'expert' })
    );
  });

  it('mints guest attempts with the requested gameMode', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    await caller.puzzle.next({
      subreddit: 'askreddit',
      rankIndex: 1,
      gameMode: 'expert',
    });

    expect(mockGetGameMode).not.toHaveBeenCalled();
    expect(mockSetAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ gameMode: 'expert' })
    );
  });
});

describe('puzzle.submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAttempt.mockResolvedValue(makeAttempt());
    mockGetSnapshot.mockResolvedValue(makeSnapshot());
    mockAcquireSubmitLock.mockResolvedValue(true);
    mockMarkAttemptSubmitted.mockResolvedValue(undefined);
    mockGetProgress.mockResolvedValue(3);
    mockIncrementProgress.mockResolvedValue(4);
    mockIncrementStats.mockResolvedValue(5);
    mockGetStats.mockResolvedValue({
      global: { correctSlots: 3, totalSlots: 6 },
      bySubreddit: {
        askreddit: {
          aggregate: { correctSlots: 3, totalSlots: 6 },
          byTimeframe: {
            all: { correctSlots: 3, totalSlots: 6 },
          },
        },
      },
      coins: 5,
    });
    mockUpdateLeaderboard.mockResolvedValue(undefined);
  });

  it('returns ATTEMPT_EXPIRED when attempt is missing', async () => {
    mockGetAttempt.mockResolvedValue(null);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'ATTEMPT_EXPIRED',
        nextAction: 'request_next_puzzle',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns INVALID_SLOT_PERMUTATION for duplicate slot IDs', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput(['t1_c1', 't1_c1', 't1_c2']));

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'INVALID_SLOT_PERMUTATION',
        nextAction: 'resubmit_valid_slots',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns ATTEMPT_ALREADY_SUBMITTED when attempt is already submitted', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ submitted: true }));
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'ATTEMPT_ALREADY_SUBMITTED',
        nextAction: 'request_next_puzzle',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns HOST_SUBREDDIT_LOCKED on Community host mismatch', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ subreddit: 'askreddit' }));
    const caller = createCaller(
      makeCtx({ subredditName: 'gaming', surface: 'community', userId: 'user-1' })
    );

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'HOST_SUBREDDIT_LOCKED',
        nextAction: 'refresh_game',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns WRONG_USER when current user does not match attempt owner', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ owner: { kind: 'user', userId: 'user-1' } }));
    const caller = createCaller(makeCtx({ userId: 'user-2' }));

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'WRONG_USER',
        nextAction: 'refresh_game',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns STALE_PROGRESS with currentRankIndex when progress moved on', async () => {
    mockGetProgress.mockResolvedValue(5);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'STALE_PROGRESS',
        nextAction: 'request_next_puzzle',
        currentRankIndex: 5,
      })
    );
    expectNoSubmitMutations();
  });

  it('returns SNAPSHOT_MISSING when snapshot is unavailable', async () => {
    mockGetSnapshot.mockResolvedValue(null);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'SNAPSHOT_MISSING',
        nextAction: 'request_next_puzzle',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns ATTEMPT_ALREADY_SUBMITTED when submit lock acquisition fails', async () => {
    mockAcquireSubmitLock.mockResolvedValue(false);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'ATTEMPT_ALREADY_SUBMITTED',
        nextAction: 'request_next_puzzle',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns score 3 and correct reveal slots for a perfect submission', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput(['t1_c1', 't1_c2', 't1_c3']));

    expect(result.status).toBe('submitted');
    if (result.status !== 'submitted') {
      return;
    }

    expect(result.score).toBe(3);
    expect(result.slots).toEqual([
      {
        commentId: 't1_c1',
        body: 'First valid comment body with enough visible characters.',
        score: 100,
        correct: true,
      },
      {
        commentId: 't1_c2',
        body: 'Second valid comment body with enough visible characters.',
        score: 50,
        correct: true,
      },
      {
        commentId: 't1_c3',
        body: 'Third valid comment body with enough visible characters.',
        score: 25,
        correct: true,
      },
    ]);
  });

  it('returns score 0 when all slots are wrong', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput(['t1_c2', 't1_c3', 't1_c1']));

    expect(result.status).toBe('submitted');
    if (result.status !== 'submitted') {
      return;
    }

    expect(result.score).toBe(0);
    expect(result.slots.every((slot) => slot.correct === false)).toBe(true);
  });

  it('updates user-owned stats, progress, and leaderboard on success', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(mockIncrementStats).toHaveBeenCalledWith('user-1', askredditAllCtx, {
      correctSlots: 3,
      coinAward: 3,
    });
    expect(mockIncrementProgress).toHaveBeenCalledWith('user-1', askredditAllCtx);
    expect(mockUpdateLeaderboard).toHaveBeenCalledWith(askredditAllCtx, 'user-1', 3);
    expect(mockMarkAttemptSubmitted).toHaveBeenCalledOnce();

    expect(result.status).toBe('submitted');
    if (result.status !== 'submitted') {
      return;
    }

    expect(result.nextRankIndex).toBe(4);
    expect(result.userHiveIQ).toEqual({
      userSubredditHiveIQ: 125,
      currentRankIndex: 4,
      activeTimeframe: 'all',
    });
    expect(result.coins).toBe(5);
  });

  it('does not write user stats or leaderboard for guest attempts', async () => {
    mockGetAttempt.mockResolvedValue(
      makeAttempt({ owner: { kind: 'guest' }, rankIndex: 2 })
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(mockIncrementStats).not.toHaveBeenCalled();
    expect(mockIncrementProgress).not.toHaveBeenCalled();
    expect(mockUpdateLeaderboard).not.toHaveBeenCalled();
    expect(mockGetProgress).not.toHaveBeenCalled();

    expect(result.status).toBe('submitted');
    if (result.status !== 'submitted') {
      return;
    }

    expect(result.userHiveIQ).toBeNull();
    expect(result.nextRankIndex).toBe(3);
    expect(result.coins).toBeNull();
  });

  it('returns INVALID_SELECTED_COMMENT for an unknown casual pick', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ gameMode: 'casual' }));
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(
      makeCasualSubmitInput('t1_unknown')
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'INVALID_SELECTED_COMMENT',
        nextAction: 'resubmit_valid_slots',
      })
    );
    expectNoSubmitMutations();
  });

  it('rejects expert submit payload on a casual attempt', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ gameMode: 'casual' }));
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'INVALID_SLOT_PERMUTATION',
        nextAction: 'resubmit_valid_slots',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns score 3 and truth-order reveal for a perfect casual #1 pick', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ gameMode: 'casual' }));
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeCasualSubmitInput('t1_c1'));

    expect(result.status).toBe('submitted');
    if (result.status !== 'submitted') {
      return;
    }

    expect(result.score).toBe(3);
    expect(result.slots).toEqual([
      {
        commentId: 't1_c1',
        body: 'First valid comment body with enough visible characters.',
        score: 100,
        correct: true,
      },
      {
        commentId: 't1_c2',
        body: 'Second valid comment body with enough visible characters.',
        score: 50,
        correct: false,
      },
      {
        commentId: 't1_c3',
        body: 'Third valid comment body with enough visible characters.',
        score: 25,
        correct: false,
      },
    ]);
    expect(mockIncrementStats).toHaveBeenCalledWith('user-1', askredditAllCtx, {
      correctSlots: 1,
      coinAward: 3,
    });
  });

  it('returns score 1 for a casual #2 pick with no Hive IQ credit', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ gameMode: 'casual' }));
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeCasualSubmitInput('t1_c2'));

    expect(result.status).toBe('submitted');
    if (result.status !== 'submitted') {
      return;
    }

    expect(result.score).toBe(1);
    expect(result.slots.every((slot) => slot.correct === false)).toBe(true);
    expect(mockIncrementStats).toHaveBeenCalledWith('user-1', askredditAllCtx, {
      correctSlots: 0,
      coinAward: 1,
    });
  });

  it('returns score 0 for a casual #3 pick', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ gameMode: 'casual' }));
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.submit(makeCasualSubmitInput('t1_c3'));

    expect(result.status).toBe('submitted');
    if (result.status !== 'submitted') {
      return;
    }

    expect(result.score).toBe(0);
    expect(mockIncrementStats).toHaveBeenCalledWith('user-1', askredditAllCtx, {
      correctSlots: 0,
      coinAward: 0,
    });
  });
});

describe('puzzle.skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAttempt.mockResolvedValue(makeAttempt());
    mockGetSnapshot.mockResolvedValue(makeSnapshot());
    mockGetProgress.mockResolvedValue(3);
    mockIncrementProgress.mockResolvedValue(4);
    mockAcquireSubmitLock.mockResolvedValue(true);
    mockMarkAttemptSubmitted.mockResolvedValue(undefined);
    mockGetStats.mockResolvedValue({
      global: { correctSlots: 0, totalSlots: 0 },
      bySubreddit: {},
      coins: 3,
    });
    mockDeductCoin.mockResolvedValue({ ok: true, coins: 2 });
  });

  it('returns ATTEMPT_EXPIRED when attempt is missing', async () => {
    mockGetAttempt.mockResolvedValue(null);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.skip(makeSkipInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'ATTEMPT_EXPIRED',
        nextAction: 'request_next_puzzle',
      })
    );
    expectNoSubmitMutations();
  });

  it('advances logged-in progress without updating stats or leaderboard', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.skip(makeSkipInput());

    expect(result).toEqual({
      status: 'skipped',
      score: 0,
      slots: [
        {
          commentId: 't1_c1',
          body: 'First valid comment body with enough visible characters.',
          score: 100,
          correct: true,
        },
        {
          commentId: 't1_c2',
          body: 'Second valid comment body with enough visible characters.',
          score: 50,
          correct: true,
        },
        {
          commentId: 't1_c3',
          body: 'Third valid comment body with enough visible characters.',
          score: 25,
          correct: true,
        },
      ],
      userHiveIQ: null,
      nextRankIndex: 4,
      coins: 2,
    });
    expect(mockGetSnapshot).toHaveBeenCalledWith('t3_abc123');
    expect(mockDeductCoin).toHaveBeenCalledWith('user-1');
    expect(mockIncrementProgress).toHaveBeenCalledWith('user-1', askredditAllCtx);
    expect(mockMarkAttemptSubmitted).toHaveBeenCalledOnce();
    expect(mockIncrementStats).not.toHaveBeenCalled();
    expect(mockUpdateLeaderboard).not.toHaveBeenCalled();
  });

  it('returns next rank for guest attempts without writing user stats', async () => {
    mockGetAttempt.mockResolvedValue(
      makeAttempt({ owner: { kind: 'guest' }, rankIndex: 2 })
    );
    const caller = createCaller(makeCtx({ userId: undefined }));

    const result = await caller.puzzle.skip(makeSkipInput());

    expect(result).toEqual({
      status: 'skipped',
      score: 0,
      slots: [
        {
          commentId: 't1_c1',
          body: 'First valid comment body with enough visible characters.',
          score: 100,
          correct: true,
        },
        {
          commentId: 't1_c2',
          body: 'Second valid comment body with enough visible characters.',
          score: 50,
          correct: true,
        },
        {
          commentId: 't1_c3',
          body: 'Third valid comment body with enough visible characters.',
          score: 25,
          correct: true,
        },
      ],
      userHiveIQ: null,
      nextRankIndex: 3,
      coins: null,
    });
    expect(mockDeductCoin).not.toHaveBeenCalled();
    expect(mockIncrementProgress).not.toHaveBeenCalled();
    expect(mockIncrementStats).not.toHaveBeenCalled();
    expect(mockUpdateLeaderboard).not.toHaveBeenCalled();
    expect(mockMarkAttemptSubmitted).toHaveBeenCalledOnce();
  });

  it('returns INSUFFICIENT_COINS when the wallet is empty', async () => {
    mockGetStats.mockResolvedValue({
      global: { correctSlots: 0, totalSlots: 0 },
      bySubreddit: {},
      coins: 0,
    });
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.skip(makeSkipInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'INSUFFICIENT_COINS',
        nextAction: 'resubmit_valid_slots',
      })
    );
    expect(mockDeductCoin).not.toHaveBeenCalled();
    expect(mockIncrementProgress).not.toHaveBeenCalled();
    expect(mockMarkAttemptSubmitted).not.toHaveBeenCalled();
  });
});

describe('puzzle.forfeit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAttempt.mockResolvedValue(makeAttempt({ gameMode: 'casual' }));
    mockGetSnapshot.mockResolvedValue(makeSnapshot());
    mockGetProgress.mockResolvedValue(3);
    mockIncrementProgress.mockResolvedValue(4);
    mockAcquireSubmitLock.mockResolvedValue(true);
    mockMarkAttemptSubmitted.mockResolvedValue(undefined);
    mockIncrementStats.mockResolvedValue(5);
    mockGetStats.mockResolvedValue({
      global: { correctSlots: 0, totalSlots: 3 },
      bySubreddit: {
        askreddit: {
          aggregate: { correctSlots: 0, totalSlots: 3 },
          byTimeframe: {},
        },
      },
      coins: 5,
    });
    mockUpdateLeaderboard.mockResolvedValue(undefined);
  });

  it('returns ATTEMPT_EXPIRED when attempt is missing', async () => {
    mockGetAttempt.mockResolvedValue(null);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.forfeit(makeSkipInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'ATTEMPT_EXPIRED',
        nextAction: 'request_next_puzzle',
      })
    );
    expectNoSubmitMutations();
  });

  it('rejects expert attempts', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ gameMode: 'expert' }));
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.forfeit(makeSkipInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'EXPERT_MODE_FORFEIT_NOT_ALLOWED',
        nextAction: 'resubmit_valid_slots',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns forfeited result with truth-order slots and zero score', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.forfeit(makeSkipInput());

    expect(result).toEqual({
      status: 'forfeited',
      score: 0,
      slots: [
        {
          commentId: 't1_c1',
          body: 'First valid comment body with enough visible characters.',
          score: 100,
          correct: false,
        },
        {
          commentId: 't1_c2',
          body: 'Second valid comment body with enough visible characters.',
          score: 50,
          correct: false,
        },
        {
          commentId: 't1_c3',
          body: 'Third valid comment body with enough visible characters.',
          score: 25,
          correct: false,
        },
      ],
      userHiveIQ: {
        userSubredditHiveIQ: 70,
        currentRankIndex: 4,
        activeTimeframe: 'all',
      },
      nextRankIndex: 4,
      coins: 5,
    });
    expect(mockIncrementStats).toHaveBeenCalledWith('user-1', askredditAllCtx, {
      correctSlots: 0,
      coinAward: 0,
    });
    expect(mockIncrementProgress).toHaveBeenCalledWith('user-1', askredditAllCtx);
    expect(mockUpdateLeaderboard).toHaveBeenCalledWith(askredditAllCtx, 'user-1', 3);
    expect(mockMarkAttemptSubmitted).toHaveBeenCalledOnce();
    expect(mockDeductCoin).not.toHaveBeenCalled();
  });

  it('returns ATTEMPT_ALREADY_SUBMITTED when submit lock acquisition fails', async () => {
    mockAcquireSubmitLock.mockResolvedValue(false);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.puzzle.forfeit(makeSkipInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'ATTEMPT_ALREADY_SUBMITTED',
        nextAction: 'request_next_puzzle',
      })
    );
    expectNoSubmitMutations();
  });

  it('returns next rank for guest attempts without writing user stats', async () => {
    mockGetAttempt.mockResolvedValue(
      makeAttempt({ owner: { kind: 'guest' }, rankIndex: 2, gameMode: 'casual' })
    );
    const caller = createCaller(makeCtx({ userId: undefined }));

    const result = await caller.puzzle.forfeit(makeSkipInput());

    expect(result).toEqual({
      status: 'forfeited',
      score: 0,
      slots: [
        {
          commentId: 't1_c1',
          body: 'First valid comment body with enough visible characters.',
          score: 100,
          correct: false,
        },
        {
          commentId: 't1_c2',
          body: 'Second valid comment body with enough visible characters.',
          score: 50,
          correct: false,
        },
        {
          commentId: 't1_c3',
          body: 'Third valid comment body with enough visible characters.',
          score: 25,
          correct: false,
        },
      ],
      userHiveIQ: null,
      nextRankIndex: 3,
      coins: null,
    });
    expect(mockIncrementStats).not.toHaveBeenCalled();
    expect(mockIncrementProgress).not.toHaveBeenCalled();
    expect(mockUpdateLeaderboard).not.toHaveBeenCalled();
    expect(mockMarkAttemptSubmitted).toHaveBeenCalledOnce();
  });

  it('isolates STALE_PROGRESS checks to the attempt timeframe', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ timeframe: 'month', rankIndex: 3 }));
    mockGetProgress.mockImplementation(async (_userId, ctx) => {
      if (ctx.timeframe === 'month') {
        return 5;
      }
      if (ctx.timeframe === 'all') {
        return 3;
      }
      return 1;
    });

    const caller = createCaller(makeCtx({ userId: 'user-1' }));
    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        code: 'STALE_PROGRESS',
        currentRankIndex: 5,
      })
    );
    expect(mockGetProgress).toHaveBeenCalledWith('user-1', {
      subredditName: 'askreddit',
      timeframe: 'month',
    });
    expectNoSubmitMutations();
  });

  it('does not treat progress in another timeframe as stale for the attempt', async () => {
    mockGetAttempt.mockResolvedValue(makeAttempt({ timeframe: 'month', rankIndex: 3 }));
    mockGetProgress.mockImplementation(async (_userId, ctx) => {
      if (ctx.timeframe === 'month') {
        return 3;
      }
      if (ctx.timeframe === 'all') {
        return 10;
      }
      return 1;
    });

    const caller = createCaller(makeCtx({ userId: 'user-1' }));
    const result = await caller.puzzle.submit(makeSubmitInput());

    expect(result.status).toBe('submitted');
    expect(mockUpdateLeaderboard).toHaveBeenCalledWith(
      { subredditName: 'askreddit', timeframe: 'month' },
      'user-1',
      3
    );
  });
});
