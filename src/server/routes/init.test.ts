import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../trpc';
import { DEFAULT_GAME_MODE, type UserStatsProfile } from '../../shared/api';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';

const {
  mockListProgressEntries,
  mockGetProgress,
  mockGetStats,
  mockGetGameMode,
  mockResolveSubredditMetadata,
  mockGetLeaderboardRank,
  mockEnsureWelcomeCoins,
} = vi.hoisted(() => ({
  mockListProgressEntries: vi.fn(),
  mockGetProgress: vi.fn(),
  mockGetStats: vi.fn(),
  mockGetGameMode: vi.fn(),
  mockResolveSubredditMetadata: vi.fn(),
  mockGetLeaderboardRank: vi.fn(),
  mockEnsureWelcomeCoins: vi.fn(),
}));

vi.mock('../reddit/resolveSubredditMetadata.js', () => ({
  resolveSubredditMetadata: mockResolveSubredditMetadata,
}));

vi.mock('../redis/progressStore.js', () => ({
  getProgress: mockGetProgress,
  setProgress: vi.fn(),
  incrementProgress: vi.fn(),
  listProgressEntries: mockListProgressEntries,
}));

vi.mock('../redis/statsStore.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../redis/statsStore.js')>();
  return {
    ...original,
    getStats: mockGetStats,
    getGameMode: mockGetGameMode,
    ensureWelcomeCoins: mockEnsureWelcomeCoins,
  };
});

vi.mock('../redis/leaderboardStore.js', () => ({
  updateLeaderboard: vi.fn(),
  getLeaderboardRank: mockGetLeaderboardRank,
  getLeaderboardPage: vi.fn(),
  getEcosystemLeaderboardPage: vi.fn(),
  getEcosystemLeaderboardRank: vi.fn(),
}));

vi.mock('../redis/profileStore.js', () => ({
  upsertUsername: vi.fn(),
  getUsername: vi.fn(),
  getUsernames: vi.fn(),
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
    getCurrentUsername: vi.fn().mockResolvedValue(undefined),
  },
  userId: undefined,
  subredditName: 'suboffame',
  surface: 'profile',
  ...overrides,
});

const emptyStats = (): UserStatsProfile => ({
  global: { correctSlots: 0, totalSlots: 0 },
  bySubreddit: {},
  coins: 0,
});

const makeStats = (
  overrides: {
    global?: { correctSlots: number; totalSlots: number };
    bySubreddit?: Record<
      string,
      {
        correctSlots: number;
        totalSlots: number;
        currentStreak?: number;
        highestStreak?: number;
      }
    >;
    coins?: number;
  } = {}
): UserStatsProfile => {
  const bySubreddit: UserStatsProfile['bySubreddit'] = {};
  for (const [subreddit, counters] of Object.entries(overrides.bySubreddit ?? {})) {
    bySubreddit[subreddit] = {
      aggregate: {
        correctSlots: counters.correctSlots,
        totalSlots: counters.totalSlots,
      },
      byTimeframe: {},
      currentStreak: counters.currentStreak ?? 0,
      highestStreak: counters.highestStreak ?? 0,
    };
  }

  return {
    global: overrides.global ?? { correctSlots: 0, totalSlots: 0 },
    bySubreddit,
    coins: overrides.coins ?? 0,
  };
};

describe('init — logged-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockImplementation(async (subreddit: string) =>
      makeMetadata(subreddit)
    );
    mockGetLeaderboardRank.mockResolvedValue(null);
    mockListProgressEntries.mockResolvedValue([]);
    mockGetStats.mockResolvedValue(emptyStats());
    mockGetProgress.mockResolvedValue(1);
    mockEnsureWelcomeCoins.mockResolvedValue(3);
  });

  it('returns null for all user fields on logged-out Hub', async () => {
    const caller = createCaller(makeCtx({ userId: undefined, subredditName: 'suboffame', surface: 'profile' }));

    const result = await caller.init();

    expect(result).toEqual({
      hostSubreddit: 'suboffame',
      isHub: true,
      activeSubreddit: null,
      playerName: 'Guest',
      gameMode: DEFAULT_GAME_MODE,
      hasGameData: false,
      coins: null,
      userGlobalHiveIQ: null,
      dashboardSubreddits: null,
      activeSubredditMetrics: null,
      campaignMetrics: null,
      dailyChallenge: { subreddit: 'all', resetsAt: expect.any(Number) },
    });
    expect(mockListProgressEntries).not.toHaveBeenCalled();
    expect(mockGetProgress).not.toHaveBeenCalled();
    expect(mockGetStats).not.toHaveBeenCalled();
    expect(mockGetLeaderboardRank).not.toHaveBeenCalled();
    expect(mockResolveSubredditMetadata).not.toHaveBeenCalled();
  });

  it('returns a single host dashboard card on logged-out Community', async () => {
    const caller = createCaller(
      makeCtx({ userId: undefined, subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result).toEqual({
      hostSubreddit: 'gaming',
      isHub: false,
      activeSubreddit: 'gaming',
      playerName: 'Guest',
      gameMode: DEFAULT_GAME_MODE,
      hasGameData: false,
      coins: null,
      userGlobalHiveIQ: null,
      dashboardSubreddits: [
        {
          subreddit: 'gaming',
          displayName: 'gaming',
          iconUrl: 'https://example.com/gaming.png',
          metadataSource: 'curated',
          currentRankIndex: 1,
          userSubredditHiveIQ: null,
          completedRoundCount: 0,
          leaderboardRank: null,
          currentStreak: 0,
          highestStreak: 0,
        },
      ],
      activeSubredditMetrics: null,
      campaignMetrics: null,
      dailyChallenge: { subreddit: 'all', resetsAt: expect.any(Number) },
    });
    expect(mockListProgressEntries).not.toHaveBeenCalled();
    expect(mockGetProgress).not.toHaveBeenCalled();
    expect(mockGetStats).not.toHaveBeenCalled();
    expect(mockGetLeaderboardRank).not.toHaveBeenCalled();
    expect(mockResolveSubredditMetadata).toHaveBeenCalledWith('gaming', expect.anything());
  });
});

describe('init — logged-in Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockImplementation(async (subreddit: string) =>
      makeMetadata(subreddit)
    );
    mockGetLeaderboardRank.mockResolvedValue(null);
    mockListProgressEntries.mockResolvedValue([]);
    mockGetStats.mockResolvedValue(emptyStats());
    mockGetProgress.mockResolvedValue(1);
    mockEnsureWelcomeCoins.mockResolvedValue(3);
    mockGetGameMode.mockResolvedValue(DEFAULT_GAME_MODE);
  });

  it('returns stored gameMode for logged-in users', async () => {
    mockGetGameMode.mockResolvedValue('expert');
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    expect(result.gameMode).toBe('expert');
    expect(mockGetGameMode).toHaveBeenCalledWith('user-1');
  });

  it('includes all CURATED_SUBREDDITS names in dashboardSubreddits', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    expect(result.coins).toBe(3);
    expect(mockEnsureWelcomeCoins).toHaveBeenCalledWith('user-1');
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
    mockListProgressEntries.mockResolvedValue([
      { subredditName: 'customsub', timeframe: 'all', rankIndex: 5 },
    ]);
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
    mockListProgressEntries.mockResolvedValue([
      { subredditName: 'customsub', timeframe: 'all', rankIndex: 2 },
    ]);
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
    expect(askredditCard?.userSubredditHiveIQ).toBe(150);
  });

  it('serializes per-subreddit current and highest streaks on dashboard cards', async () => {
    mockGetStats.mockResolvedValue(
      makeStats({
        bySubreddit: {
          askreddit: {
            correctSlots: 6,
            totalSlots: 9,
            currentStreak: 3,
            highestStreak: 8,
          },
        },
      })
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const askredditCard = result.dashboardSubreddits?.find((card) => card.subreddit === 'askreddit');
    expect(askredditCard?.currentStreak).toBe(3);
    expect(askredditCard?.highestStreak).toBe(8);
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
    mockListProgressEntries.mockResolvedValue([
      { subredditName: 'customsub', timeframe: 'all', rankIndex: 3 },
    ]);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const cardNames = result.dashboardSubreddits?.map((card) => card.subreddit) ?? [];
    expect(cardNames).toEqual(['sports', 'cats', 'customsub', 'askreddit', 'funny']);
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
    mockGetLeaderboardRank.mockImplementation(async (ctx) =>
      ctx.subredditName === 'askreddit' ? 3 : null
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const askredditCard = result.dashboardSubreddits?.find((card) => card.subreddit === 'askreddit');
    expect(askredditCard?.leaderboardRank).toBe(3);
  });

  it('excludes the Daily Challenge subreddit from dashboardSubreddits even when it appears in progress or stats', async () => {
    mockListProgressEntries.mockResolvedValue([
      { subredditName: 'all', timeframe: 'all', rankIndex: 5 },
    ]);
    mockGetStats.mockResolvedValue(
      makeStats({
        bySubreddit: {
          all: { correctSlots: 3, totalSlots: 6 },
        },
      })
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    const cardNames = result.dashboardSubreddits?.map((card) => card.subreddit) ?? [];
    expect(cardNames).not.toContain('all');
  });

  it('returns a dailyChallenge object with the all subreddit and a future resetsAt for logged-in Hub', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    expect(result.dailyChallenge).toEqual({
      subreddit: 'all',
      resetsAt: expect.any(Number),
    });
    expect(result.dailyChallenge?.resetsAt ?? 0).toBeGreaterThan(Date.now());
  });

  it('excludes a card when resolveSubredditMetadata returns null', async () => {
    mockListProgressEntries.mockResolvedValue([
      { subredditName: 'inaccessible', timeframe: 'all', rankIndex: 2 },
    ]);
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

  it('returns hasGameData true when global totalSlots is greater than 0', async () => {
    mockGetStats.mockResolvedValue(
      makeStats({
        global: { correctSlots: 2, totalSlots: 3 },
      })
    );
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    expect(result.hasGameData).toBe(true);
  });

  it('returns hasGameData true when progress rankIndex is greater than 1', async () => {
    mockListProgressEntries.mockResolvedValue([
      { subredditName: 'askreddit', timeframe: 'all', rankIndex: 3 },
    ]);
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    expect(result.hasGameData).toBe(true);
  });

  it('returns hasGameData false for a new player with no stats or progress', async () => {
    const caller = createCaller(makeCtx({ userId: 'user-1' }));

    const result = await caller.init();

    expect(result.hasGameData).toBe(false);
  });
});

describe('init — logged-in Community', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockImplementation(async (subreddit: string) =>
      makeMetadata(subreddit)
    );
    mockGetLeaderboardRank.mockResolvedValue(null);
    mockListProgressEntries.mockResolvedValue([]);
    mockGetStats.mockResolvedValue(emptyStats());
    mockGetProgress.mockResolvedValue(1);
    mockEnsureWelcomeCoins.mockResolvedValue(3);
    mockGetGameMode.mockResolvedValue(DEFAULT_GAME_MODE);
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
      userSubredditHiveIQ: 125,
      activeTimeframe: 'all',
    });
    expect(mockGetProgress).toHaveBeenCalledWith('user-1', {
      subredditName: 'gaming',
      timeframe: 'all',
    });
  });

  it('returns null userSubredditHiveIQ in activeSubredditMetrics when totalSlots is 0', async () => {
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.activeSubredditMetrics?.userSubredditHiveIQ).toBeNull();
  });

  it('returns a single host dashboard card for logged-in Community', async () => {
    mockGetProgress.mockResolvedValue(4);
    mockGetStats.mockResolvedValue(
      makeStats({
        bySubreddit: {
          gaming: { correctSlots: 3, totalSlots: 6 },
        },
      })
    );
    mockGetLeaderboardRank.mockResolvedValue(2);
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.dashboardSubreddits).toEqual([
      {
        subreddit: 'gaming',
        displayName: 'gaming',
        iconUrl: 'https://example.com/gaming.png',
        metadataSource: 'curated',
        currentRankIndex: 4,
        userSubredditHiveIQ: 125,
        completedRoundCount: 2,
        leaderboardRank: 2,
        currentStreak: 0,
        highestStreak: 0,
      },
    ]);
    expect(result.campaignMetrics).toHaveLength(6);
    expect(mockListProgressEntries).toHaveBeenCalledWith('user-1');
    expect(mockResolveSubredditMetadata).toHaveBeenCalledWith('gaming', expect.anything());
    expect(mockGetLeaderboardRank).toHaveBeenCalledWith(
      { subredditName: 'gaming', timeframe: 'all' },
      'user-1'
    );
  });

  it('sets activeSubreddit to the normalized hostSubreddit', async () => {
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: ' R/Gaming ', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.isHub).toBe(false);
    expect(result.activeSubreddit).toBe('gaming');
  });

  it('returns hasGameData true when community progress rankIndex is greater than 1', async () => {
    mockGetProgress.mockResolvedValue(2);
    mockListProgressEntries.mockResolvedValue([
      { subredditName: 'gaming', timeframe: 'all', rankIndex: 2 },
    ]);
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.hasGameData).toBe(true);
  });

  it('returns hasGameData false for a new community player', async () => {
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.hasGameData).toBe(false);
  });

  it('returns a dailyChallenge object with a future resetsAt for logged-in Community', async () => {
    const caller = createCaller(
      makeCtx({ userId: 'user-1', subredditName: 'gaming', surface: 'community' })
    );

    const result = await caller.init();

    expect(result.dailyChallenge).toEqual({
      subreddit: 'all',
      resetsAt: expect.any(Number),
    });
    expect(result.dailyChallenge?.resetsAt ?? 0).toBeGreaterThan(Date.now());
  });
});
