import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { TRPCContext } from '../trpc';

const {
  mockResolveSubredditMetadata,
  mockResolveLadderPage,
  mockGetProgress,
  mockGetAllProgress,
  mockGetStats,
  mockDeductCoins,
  mockSetGameMode,
  mockSetMetadata,
  mockSetProgress,
  mockIncrementProgress,
} = vi.hoisted(() => ({
  mockResolveSubredditMetadata: vi.fn(),
  mockResolveLadderPage: vi.fn(),
  mockGetProgress: vi.fn(),
  mockGetAllProgress: vi.fn(),
  mockGetStats: vi.fn(),
  mockDeductCoins: vi.fn(),
  mockSetGameMode: vi.fn(),
  mockSetMetadata: vi.fn(),
  mockSetProgress: vi.fn(),
  mockIncrementProgress: vi.fn(),
}));

vi.mock('../reddit/resolveSubredditMetadata.js', () => ({
  resolveSubredditMetadata: mockResolveSubredditMetadata,
}));

vi.mock('../reddit/ladderPipeline.js', () => ({
  resolveLadderPage: mockResolveLadderPage,
}));

vi.mock('../redis/progressStore.js', () => ({
  getProgress: mockGetProgress,
  getAllProgress: mockGetAllProgress,
  setProgress: mockSetProgress,
  incrementProgress: mockIncrementProgress,
}));

vi.mock('../redis/statsStore.js', () => ({
  getStats: mockGetStats,
  deductCoins: mockDeductCoins,
  setGameMode: mockSetGameMode,
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

const customMetadata = {
  subreddit: 'customsub',
  displayName: 'Custom Sub',
  iconUrl: 'https://example.com/custom.png',
  metadataSource: 'reddit' as const,
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
  surface: 'community',
  ...overrides,
});

const makeLadderHit = () => ({
  kind: 'hit' as const,
  page: {
    page: 1,
    startsAfter: null,
    nextAfter: 'cursor-1',
    posts: [],
    fetchedAt: Date.now(),
  },
  offset: 0,
});

describe('session.selectSubreddit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockResolvedValue(curatedMetadata);
    mockResolveLadderPage.mockResolvedValue(makeLadderHit());
    mockGetProgress.mockResolvedValue(1);
    mockGetAllProgress.mockResolvedValue({});
    mockGetStats.mockResolvedValue({ global: { correctSlots: 0, totalSlots: 0 }, bySubreddit: {}, coins: 100 });
    mockDeductCoins.mockResolvedValue({ ok: true, coins: 75 });
  });

  it('rejects community surface launches with HOST_SUBREDDIT_LOCKED', async () => {
    const caller = createCaller(makeCtx({ subredditName: 'gaming', surface: 'community' }));

    await expect(caller.session.selectSubreddit({ subreddit: 'gaming' })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TRPCError &&
        error.code === 'FORBIDDEN' &&
        error.message === 'HOST_SUBREDDIT_LOCKED'
    );

    expect(mockResolveSubredditMetadata).not.toHaveBeenCalled();
    expect(mockResolveLadderPage).not.toHaveBeenCalled();
  });

  it('allows non-community surface even when host subreddit is foreign', async () => {
    const caller = createCaller(makeCtx({ subredditName: 'gaming', surface: 'profile' }));

    const result = await caller.session.selectSubreddit({ subreddit: 'askreddit' });

    expect(result).toEqual({
      activeSubreddit: 'askreddit',
      currentRankIndex: 1,
      subredditMetadata: curatedMetadata,
      coins: null,
    });
  });

  it('returns SUBREDDIT_UNAVAILABLE for empty normalized input', async () => {
    const caller = createCaller(makeCtx());

    await expect(caller.session.selectSubreddit({ subreddit: '   ' })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TRPCError &&
        error.code === 'BAD_REQUEST' &&
        error.message === 'SUBREDDIT_UNAVAILABLE'
    );
  });

  it('normalizes r/ prefix and casing before resolving metadata', async () => {
    const caller = createCaller(makeCtx());

    await caller.session.selectSubreddit({ subreddit: ' R/AskReddit ' });

    expect(mockResolveSubredditMetadata).toHaveBeenCalledWith('askreddit', expect.any(Object));
  });

  it('returns curated metadata without progress writes', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));
    mockGetProgress.mockResolvedValue(4);

    const result = await caller.session.selectSubreddit({ subreddit: 'askreddit' });

    expect(result).toEqual({
      activeSubreddit: 'askreddit',
      currentRankIndex: 4,
      subredditMetadata: curatedMetadata,
      coins: 100,
    });
    expect(mockGetProgress).toHaveBeenCalledWith('user-1', 'askreddit');
    expect(mockDeductCoins).not.toHaveBeenCalled();
    expect(mockSetProgress).not.toHaveBeenCalled();
    expect(mockIncrementProgress).not.toHaveBeenCalled();
  });

  it('returns custom metadata from cache path', async () => {
    mockResolveSubredditMetadata.mockResolvedValue(customMetadata);
    const caller = createCaller(makeCtx());

    const result = await caller.session.selectSubreddit({ subreddit: 'customsub' });

    expect(result.subredditMetadata).toEqual(customMetadata);
  });

  it('returns SUBREDDIT_UNAVAILABLE when metadata resolution fails', async () => {
    mockResolveSubredditMetadata.mockResolvedValue(null);
    const caller = createCaller(makeCtx());

    await expect(caller.session.selectSubreddit({ subreddit: 'missing' })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TRPCError &&
        error.code === 'BAD_REQUEST' &&
        error.message === 'SUBREDDIT_UNAVAILABLE'
    );

    expect(mockResolveLadderPage).not.toHaveBeenCalled();
  });

  it('warms page 1 with a one-call budget', async () => {
    const caller = createCaller(makeCtx());

    await caller.session.selectSubreddit({ subreddit: 'askreddit' });

    expect(mockResolveLadderPage).toHaveBeenCalledWith(
      'askreddit',
      1,
      expect.objectContaining({
        redditCallsRemaining: 1,
        itemsCheckedRemaining: 0,
      }),
      expect.any(Object)
    );
  });

  it('returns SUBREDDIT_UNAVAILABLE when page-1 warm fails', async () => {
    mockResolveLadderPage.mockResolvedValue({ kind: 'unplayable', continuationRankIndex: 1 });
    const caller = createCaller(makeCtx());

    await expect(caller.session.selectSubreddit({ subreddit: 'askreddit' })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TRPCError &&
        error.code === 'INTERNAL_SERVER_ERROR' &&
        error.message === 'SUBREDDIT_UNAVAILABLE'
    );
  });

  it('defaults currentRankIndex to 1 for logged-out users', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    const result = await caller.session.selectSubreddit({ subreddit: 'askreddit' });

    expect(result.currentRankIndex).toBe(1);
    expect(mockGetProgress).not.toHaveBeenCalled();
    expect(result.coins).toBeNull();
  });

  it('defaults currentRankIndex to 1 when logged-in user has no progress', async () => {
    mockGetProgress.mockResolvedValue(1);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.session.selectSubreddit({ subreddit: 'askreddit' });

    expect(result.currentRankIndex).toBe(1);
  });

  it('charges coins to unlock a new custom subreddit', async () => {
    mockResolveSubredditMetadata.mockResolvedValue(customMetadata);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.session.selectSubreddit({ subreddit: 'customsub' });

    expect(result).toEqual({
      activeSubreddit: 'customsub',
      currentRankIndex: 1,
      subredditMetadata: customMetadata,
      coins: 75,
    });
    expect(mockDeductCoins).toHaveBeenCalledWith('user-1', 1);
    expect(mockSetProgress).toHaveBeenCalledWith('user-1', 'customsub', 1);
  });

  it('does not write progress when custom subreddit progress already exists', async () => {
    mockResolveSubredditMetadata.mockResolvedValue(customMetadata);
    mockGetAllProgress.mockResolvedValue({ customsub: 2 });
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.session.selectSubreddit({ subreddit: 'customsub' });

    expect(result.coins).toBe(100);
    expect(mockDeductCoins).not.toHaveBeenCalled();
    expect(mockSetProgress).not.toHaveBeenCalled();
  });

  it('returns INSUFFICIENT_COINS when the wallet is too low for a custom unlock', async () => {
    mockResolveSubredditMetadata.mockResolvedValue(customMetadata);
    mockGetStats.mockResolvedValue({ global: { correctSlots: 0, totalSlots: 0 }, bySubreddit: {}, coins: 0 });
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    await expect(caller.session.selectSubreddit({ subreddit: 'customsub' })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TRPCError &&
        error.code === 'PRECONDITION_FAILED' &&
        error.message === 'INSUFFICIENT_COINS'
    );

    expect(mockDeductCoins).not.toHaveBeenCalled();
    expect(mockSetProgress).not.toHaveBeenCalled();
  });
});

describe('session.setGameMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetGameMode.mockResolvedValue('expert');
  });

  it('persists gameMode for logged-in users', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.session.setGameMode({ gameMode: 'expert' });

    expect(result).toEqual({ gameMode: 'expert' });
    expect(mockSetGameMode).toHaveBeenCalledWith('user-1', 'expert');
  });

  it('rejects guests with FORBIDDEN', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    await expect(
      caller.session.setGameMode({ gameMode: 'casual' })
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TRPCError && error.code === 'FORBIDDEN'
    );

    expect(mockSetGameMode).not.toHaveBeenCalled();
  });
});
