import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../trpc';
import type { UserStatsProfile } from '../../shared/api';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';

const {
  mockGetAllProgress,
  mockGetProgress,
  mockGetStats,
  mockResolveSubredditMetadata,
  mockGetLeaderboardRank,
} = vi.hoisted(() => ({
  mockGetAllProgress: vi.fn(),
  mockGetProgress: vi.fn(),
  mockGetStats: vi.fn(),
  mockResolveSubredditMetadata: vi.fn(),
  mockGetLeaderboardRank: vi.fn(),
}));

vi.mock('../reddit/resolveSubredditMetadata.js', () => ({
  resolveSubredditMetadata: mockResolveSubredditMetadata,
}));

vi.mock('../redis/progressStore.js', () => ({
  getProgress: mockGetProgress,
  setProgress: vi.fn(),
  incrementProgress: vi.fn(),
  getAllProgress: mockGetAllProgress,
}));

vi.mock('../redis/statsStore.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../redis/statsStore.js')>();
  return {
    ...original,
    getStats: mockGetStats,
  };
});

vi.mock('../redis/leaderboardStore.js', () => ({
  updateLeaderboard: vi.fn(),
  getLeaderboardRank: mockGetLeaderboardRank,
  getLeaderboardPage: vi.fn(),
}));

const { appRouter } = await import('../appRouter.js');
const { createCallerFactory } = await import('../trpc.js');

const createCaller = createCallerFactory(appRouter);

const makeMetadata = (subreddit: string) => ({
  subreddit,
  displayName: subreddit,
  iconUrl: `https://example.com/${subreddit}.png`,
  metadataSource: 'curated' as const,
});

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

const emptyStats = (): UserStatsProfile => ({
  global: { correctSlots: 0, totalSlots: 0 },
  bySubreddit: {},
});

const makeStats = (
  overrides: {
    global?: { correctSlots: number; totalSlots: number };
    bySubreddit?: Record<string, { correctSlots: number; totalSlots: number }>;
  } = {}
): UserStatsProfile => ({
  global: overrides.global ?? { correctSlots: 0, totalSlots: 0 },
  bySubreddit: overrides.bySubreddit ?? {},
});

describe('init — logged-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockImplementation(async (subreddit: string) =>
      makeMetadata(subreddit)
    );
    mockGetLeaderboardRank.mockResolvedValue(null);
    mockGetAllProgress.mockResolvedValue({});
    mockGetStats.mockResolvedValue(emptyStats());
    mockGetProgress.mockResolvedValue(1);
  });

  it('returns null for all user fields on logged-out Hub', async () => {
    const caller = createCaller(makeCtx({ userId: undefined, subredditName: 'suboffame', surface: 'profile' }));

    const result = await caller.init();

    expect(result).toEqual({
      hostSubreddit: 'suboffame',
      isHub: true,
      activeSubreddit: null,
      userGlobalHiveIQ: null,
      dashboardSubreddits: null,
      activeSubredditMetrics: null,
    });
    expect(mockGetAllProgress).not.toHaveBeenCalled();
    expect(mockGetProgress).not.toHaveBeenCalled();
    expect(mockGetStats).not.toHaveBeenCalled();
    expect(mockGetLeaderboardRank).not.toHaveBeenCalled();
    expect(mockResolveSubredditMetadata).not.toHaveBeenCalled();
  });

  it('returns hostSubreddit as activeSubreddit on logged-out Community with no user fields', async () => {
    const caller = createCaller(
      makeCtx({ userId: undefined, subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result).toEqual({
      hostSubreddit: 'gaming',
      isHub: false,
      activeSubreddit: 'gaming',
      userGlobalHiveIQ: null,
      dashboardSubreddits: null,
      activeSubredditMetrics: null,
    });
    expect(mockGetAllProgress).not.toHaveBeenCalled();
    expect(mockGetProgress).not.toHaveBeenCalled();
    expect(mockGetStats).not.toHaveBeenCalled();
    expect(mockGetLeaderboardRank).not.toHaveBeenCalled();
    expect(mockResolveSubredditMetadata).not.toHaveBeenCalled();
  });
});

describe('init — logged-in Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockImplementation(async (subreddit: string) =>
      makeMetadata(subreddit)
    );
    mockGetLeaderboardRank.mockResolvedValue(null);
    mockGetAllProgress.mockResolvedValue({});
    mockGetStats.mockResolvedValue(emptyStats());
    mockGetProgress.mockResolvedValue(1);
  });

  it('includes all CURATED_SUBREDDITS names in dashboardSubreddits', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    expect(result.isHub).toBe(true);
    expect(result.activeSubreddit).toBeNull();
    expect(result.activeSubredditMetrics).toBeNull();
    expect(result.dashboardSubreddits).not.toBeNull();

    const cardNames = result.dashboardSubreddits?.map((card) => card.subreddit) ?? [];
    for (const curated of CURATED_SUBREDDITS) {
      expect(cardNames).toContain(curated.name);
    }
  });

  it('adds a custom subreddit present only in progress to dashboardSubreddits', async () => {
    mockGetAllProgress.mockResolvedValue({ customsub: 5 });
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const cardNames = result.dashboardSubreddits?.map((card) => card.subreddit) ?? [];
    expect(cardNames).toContain('customsub');
  });

  it('adds a custom subreddit present only in stats to dashboardSubreddits', async () => {
    mockGetStats.mockResolvedValue(
      makeStats({
        bySubreddit: {
          statsonly: { correctSlots: 3, totalSlots: 6 },
        },
      })
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const cardNames = result.dashboardSubreddits?.map((card) => card.subreddit) ?? [];
    expect(cardNames).toContain('statsonly');
  });

  it('de-duplicates a subreddit that appears in both progress and stats', async () => {
    mockGetAllProgress.mockResolvedValue({ customsub: 2 });
    mockGetStats.mockResolvedValue(
      makeStats({
        bySubreddit: {
          customsub: { correctSlots: 1, totalSlots: 3 },
        },
      })
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const customCards =
      result.dashboardSubreddits?.filter((card) => card.subreddit === 'customsub') ?? [];
    expect(customCards).toHaveLength(1);
  });

  it('sets userSubredditHiveIQ to null when sub totalSlots is 0', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const askredditCard = result.dashboardSubreddits?.find((card) => card.subreddit === 'askreddit');
    expect(askredditCard?.userSubredditHiveIQ).toBeNull();
  });

  it('sets userSubredditHiveIQ to a calculated value when totalSlots > 0', async () => {
    mockGetStats.mockResolvedValue(
      makeStats({
        bySubreddit: {
          askreddit: { correctSlots: 6, totalSlots: 9 },
        },
      })
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const askredditCard = result.dashboardSubreddits?.find((card) => card.subreddit === 'askreddit');
    expect(askredditCard?.userSubredditHiveIQ).toBe((6 / 9) * 100);
  });

  it('sorts dashboardSubreddits by completedRoundCount descending', async () => {
    mockGetStats.mockResolvedValue(
      makeStats({
        bySubreddit: {
          askreddit: { correctSlots: 3, totalSlots: 3 },
          cats: { correctSlots: 6, totalSlots: 9 },
          sports: { correctSlots: 9, totalSlots: 15 },
          customsub: { correctSlots: 3, totalSlots: 6 },
        },
      })
    );
    mockGetAllProgress.mockResolvedValue({ customsub: 3 });
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const cardNames = result.dashboardSubreddits?.map((card) => card.subreddit) ?? [];
    expect(cardNames).toEqual(['sports', 'cats', 'customsub', 'askreddit']);
  });

  it('computes completedRoundCount as Math.floor(totalSlots / 3)', async () => {
    mockGetStats.mockResolvedValue(
      makeStats({
        bySubreddit: {
          askreddit: { correctSlots: 4, totalSlots: 7 },
        },
      })
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const askredditCard = result.dashboardSubreddits?.find((card) => card.subreddit === 'askreddit');
    expect(askredditCard?.completedRoundCount).toBe(2);
  });

  it('sets leaderboardRank from getLeaderboardRank return value', async () => {
    mockGetLeaderboardRank.mockImplementation(async (subreddit: string) =>
      subreddit === 'askreddit' ? 3 : null
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const askredditCard = result.dashboardSubreddits?.find((card) => card.subreddit === 'askreddit');
    expect(askredditCard?.leaderboardRank).toBe(3);
  });

  it('excludes a card when resolveSubredditMetadata returns null', async () => {
    mockGetAllProgress.mockResolvedValue({ inaccessible: 2 });
    mockResolveSubredditMetadata.mockImplementation(async (subreddit: string) =>
      subreddit === 'inaccessible' ? null : makeMetadata(subreddit)
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const cardNames = result.dashboardSubreddits?.map((card) => card.subreddit) ?? [];
    expect(cardNames).not.toContain('inaccessible');
  });

  it('returns userGlobalHiveIQ object with null nested score when global totalSlots is 0', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    expect(result.userGlobalHiveIQ).toEqual({
      userGlobalHiveIQ: null,
      totalCorrectSlots: 0,
      totalSlots: 0,
    });
  });
});

describe('init — logged-in Community', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockImplementation(async (subreddit: string) =>
      makeMetadata(subreddit)
    );
    mockGetLeaderboardRank.mockResolvedValue(null);
    mockGetAllProgress.mockResolvedValue({});
    mockGetStats.mockResolvedValue(emptyStats());
    mockGetProgress.mockResolvedValue(1);
  });

  it('returns activeSubredditMetrics with currentRankIndex and userSubredditHiveIQ', async () => {
    mockGetProgress.mockResolvedValue(4);
    mockGetStats.mockResolvedValue(
      makeStats({
        bySubreddit: {
          gaming: { correctSlots: 3, totalSlots: 6 },
        },
      })
    );
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.activeSubredditMetrics).toEqual({
      currentRankIndex: 4,
      userSubredditHiveIQ: 50,
    });
    expect(mockGetProgress).toHaveBeenCalledWith('user-1', 'gaming');
  });

  it('returns null userSubredditHiveIQ in activeSubredditMetrics when totalSlots is 0', async () => {
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.activeSubredditMetrics?.userSubredditHiveIQ).toBeNull();
  });

  it('returns null dashboardSubreddits for logged-in Community', async () => {
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.dashboardSubreddits).toBeNull();
    expect(mockGetAllProgress).not.toHaveBeenCalled();
    expect(mockResolveSubredditMetadata).not.toHaveBeenCalled();
  });

  it('sets activeSubreddit to the normalized hostSubreddit', async () => {
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: ' R/Gaming ', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.isHub).toBe(false);
    expect(result.activeSubreddit).toBe('gaming');
  });
});
