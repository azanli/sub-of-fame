import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { TRPCContext } from '../trpc';
import { SUBREDDIT_UNLOCK_COST } from '../../shared/coins';

const {
  mockResolveSubredditMetadata,
  mockResolveLadderPage,
  mockGetRankIndex,
  mockListProgressEntries,
  mockGetStats,
  mockDeductCoins,
  mockSetGameMode,
  mockSetRankIndex,
  mockDeleteAllUserData,
} = vi.hoisted(() => ({
  mockResolveSubredditMetadata: vi.fn(),
  mockResolveLadderPage: vi.fn(),
  mockGetRankIndex: vi.fn(),
  mockListProgressEntries: vi.fn(),
  mockGetStats: vi.fn(),
  mockDeductCoins: vi.fn(),
  mockSetGameMode: vi.fn(),
  mockSetRankIndex: vi.fn(),
  mockDeleteAllUserData: vi.fn(),
}));

vi.mock('../reddit/resolveSubredditMetadata.js', () => ({
  resolveSubredditMetadata: mockResolveSubredditMetadata,
}));

vi.mock('../reddit/ladderPipeline.js', () => ({
  resolveLadderPage: mockResolveLadderPage,
}));

vi.mock('../redis/progressStore.js', () => ({
  listProgressEntries: mockListProgressEntries,
}));

vi.mock('../redis/rankProgress.js', () => ({
  getRankIndex: mockGetRankIndex,
  setRankIndex: mockSetRankIndex,
  advanceRankIndex: vi.fn(),
}));

vi.mock('../redis/statsStore.js', () => ({
  getStats: mockGetStats,
  deductCoins: mockDeductCoins,
  setGameMode: mockSetGameMode,
  subredditHasAnyStats: vi.fn().mockReturnValue(false),
}));

vi.mock('../redis/userDataStore.js', () => ({
  deleteAllUserData: mockDeleteAllUserData,
}));

const askredditAllCtx = { subredditName: 'askreddit', timeframe: 'all' as const };
const customAllCtx = { subredditName: 'customsub', timeframe: 'all' as const };

const { appRouter } = await import('../appRouter.js');
const { createCallerFactory } = await import('../trpc.js');

const createCaller = createCallerFactory(appRouter);

const curatedMetadata = {
  subreddit: 'askreddit',
  displayName: 'AskReddit',
  iconUrl: 'https://example.com/askreddit.png',
  isNsfw: false,
  metadataSource: 'curated' as const,
};

const customMetadata = {
  subreddit: 'customsub',
  displayName: 'Custom Sub',
  iconUrl: 'https://example.com/custom.png',
  isNsfw: false,
  metadataSource: 'reddit' as const,
};

const makeCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  reddit: {
    getSubredditInfoByName: vi.fn(),
    getSubredditStyles: vi.fn(),
    getTopPosts: vi.fn(),
    getHotPosts: vi.fn(),
    getComments: vi.fn(),
  },
  userId: undefined,
  subredditName: 'suboffame',
  surface: 'community',
  ...overrides,
});

describe('session.selectSubreddit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockResolvedValue(curatedMetadata);
    mockResolveLadderPage.mockResolvedValue({
      kind: 'hit',
      page: { page: 1, startsAfter: null, nextAfter: null, posts: [], fetchedAt: 0 },
      offset: 0,
    });
    mockGetRankIndex.mockResolvedValue(1);
    mockListProgressEntries.mockResolvedValue([]);
    mockGetStats.mockResolvedValue({
      global: { correctSlots: 0, totalSlots: 0 },
      bySubreddit: {},
      coins: 100,
    });
    mockDeductCoins.mockResolvedValue({ ok: true, coins: 75 });
  });

  it('returns curated metadata for a known subreddit', async () => {
    const caller = createCaller(makeCtx());

    const result = await caller.session.selectSubreddit({ subreddit: 'askreddit' });

    expect(result).toEqual({
      activeSubreddit: 'askreddit',
      currentRankIndex: 1,
      subredditMetadata: curatedMetadata,
      coins: null,
    });
  });

  it('resolves custom subreddit metadata from Reddit', async () => {
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
      askredditAllCtx,
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
    expect(mockGetRankIndex).not.toHaveBeenCalled();
    expect(result.coins).toBeNull();
  });

  it('defaults currentRankIndex to 1 when logged-in user has no progress', async () => {
    mockGetRankIndex.mockResolvedValue(1);
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
    expect(mockDeductCoins).toHaveBeenCalledWith('user-1', SUBREDDIT_UNLOCK_COST);
    expect(mockSetRankIndex).toHaveBeenCalledWith('user-1', customAllCtx, 1);
  });

  it('does not write progress when custom subreddit progress already exists', async () => {
    mockResolveSubredditMetadata.mockResolvedValue(customMetadata);
    mockListProgressEntries.mockResolvedValue([
      { subredditName: 'customsub', timeframe: 'all', rankIndex: 2 },
    ]);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.session.selectSubreddit({ subreddit: 'customsub' });

    expect(result.coins).toBe(100);
    expect(mockDeductCoins).not.toHaveBeenCalled();
    expect(mockSetRankIndex).not.toHaveBeenCalled();
  });

  it('returns INSUFFICIENT_COINS when the wallet is too low for a custom unlock', async () => {
    mockResolveSubredditMetadata.mockResolvedValue(customMetadata);
    mockGetStats.mockResolvedValue({
      global: { correctSlots: 0, totalSlots: 0 },
      bySubreddit: {},
      coins: 0,
    });
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    await expect(caller.session.selectSubreddit({ subreddit: 'customsub' })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TRPCError &&
        error.code === 'PRECONDITION_FAILED' &&
        error.message === 'INSUFFICIENT_COINS'
    );

    expect(mockDeductCoins).not.toHaveBeenCalled();
    expect(mockSetRankIndex).not.toHaveBeenCalled();
  });
});

describe('session.setGameMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetGameMode.mockResolvedValue('expert');
  });

  it('persists the selected mode for logged-in users', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.session.setGameMode({ gameMode: 'expert' });

    expect(result).toEqual({ gameMode: 'expert' });
    expect(mockSetGameMode).toHaveBeenCalledWith('user-1', 'expert');
  });

  it('rejects logged-out users', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    await expect(caller.session.setGameMode({ gameMode: 'expert' })).rejects.toSatisfy(
      (error: unknown) => error instanceof TRPCError && error.code === 'FORBIDDEN'
    );
  });
});

describe('session.deleteUserData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteAllUserData.mockResolvedValue(undefined);
  });

  it('wipes player data for logged-in users with the correct confirmation', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.session.deleteUserData({ confirmation: 'Delete' });

    expect(result).toEqual({ deleted: true });
    expect(mockDeleteAllUserData).toHaveBeenCalledWith('user-1');
  });

  it('rejects logged-out users', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));

    await expect(
      caller.session.deleteUserData({ confirmation: 'Delete' })
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof TRPCError && error.code === 'FORBIDDEN'
    );
  });

  it('rejects requests without the exact confirmation text', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    await expect(
      caller.session.deleteUserData({ confirmation: 'delete' })
    ).rejects.toThrow();
    expect(mockDeleteAllUserData).not.toHaveBeenCalled();
  });
});
