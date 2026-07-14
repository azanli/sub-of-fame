import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../trpc';
import type { LeaderboardEntry } from '../../shared/api';

const {
  mockGetEcosystemLeaderboardDisplayPage,
  mockGetLeaderboardDisplayPage,
  mockGetLeaderboardRank,
  mockListProgressEntries,
  mockGetStats,
  mockResolveSubredditMetadata,
} = vi.hoisted(() => ({
  mockGetEcosystemLeaderboardDisplayPage: vi.fn(),
  mockGetLeaderboardDisplayPage: vi.fn(),
  mockGetLeaderboardRank: vi.fn(),
  mockListProgressEntries: vi.fn(),
  mockGetStats: vi.fn(),
  mockResolveSubredditMetadata: vi.fn(),
}));

vi.mock('../redis/leaderboardStore.js', () => ({
  updateLeaderboard: vi.fn(),
  getLeaderboardDisplayPage: mockGetLeaderboardDisplayPage,
  getLeaderboardRank: mockGetLeaderboardRank,
  getEcosystemLeaderboardDisplayPage: mockGetEcosystemLeaderboardDisplayPage,
}));

vi.mock('../redis/progressStore.js', () => ({
  listProgressEntries: mockListProgressEntries,
  getProgress: vi.fn(),
}));

vi.mock('../redis/statsStore.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../redis/statsStore.js')>();
  return {
    ...original,
    getStats: mockGetStats,
  };
});

vi.mock('../reddit/resolveSubredditMetadata.js', () => ({
  resolveSubredditMetadata: mockResolveSubredditMetadata,
}));

const { appRouter } = await import('../appRouter.js');
const { createCallerFactory } = await import('../trpc.js');

const createCaller = createCallerFactory(appRouter);

const makeEntry = (
  overrides: Partial<LeaderboardEntry> = {}
): LeaderboardEntry => ({
  userId: 'u1',
  username: 'alpha',
  bestClearedRankIndex: 10,
  userSubredditHiveIQ: 150,
  completedRoundCount: 3,
  highestStreak: 0,
  displayRank: 1,
  isCurrentUser: true,
  ...overrides,
});

const makeTopTen = (): LeaderboardEntry[] =>
  Array.from({ length: 10 }, (_, index) =>
    makeEntry({
      userId: `top-${index + 1}`,
      username: `player${index + 1}`,
      displayRank: index + 1,
      isCurrentUser: false,
    })
  );

const makeCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  reddit: {
    getSubredditInfoByName: vi.fn(),
    getSubredditStyles: vi.fn(),
    getTopPosts: vi.fn(),
    getHotPosts: vi.fn(),
    getComments: vi.fn(),
    getCurrentUsername: vi.fn(),
    getPostById: vi.fn(),
  },
  userId: 'u1',
  subredditName: 'suboffame',
  surface: 'profile',
  ...overrides,
});

describe('leaderboard.getPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSubredditMetadata.mockImplementation(async (subreddit: string) => ({
      subreddit,
      displayName: subreddit,
      iconUrl: `https://example.com/${subreddit}.png`,
      isNsfw: false,
      metadataSource: 'curated' as const,
    }));
    mockGetEcosystemLeaderboardDisplayPage.mockResolvedValue([makeEntry()]);
    mockGetLeaderboardDisplayPage.mockResolvedValue([
      makeEntry({ username: 'beta', isCurrentUser: false }),
    ]);
    mockGetLeaderboardRank.mockResolvedValue(2);
    mockListProgressEntries.mockResolvedValue([
      { subredditName: 'askreddit', timeframe: 'all', rankIndex: 4 },
    ]);
    mockGetStats.mockResolvedValue({
      global: { correctSlots: 6, totalSlots: 9 },
      bySubreddit: {
        askreddit: {
          aggregate: { correctSlots: 6, totalSlots: 9 },
          byTimeframe: {},
          currentStreak: 0,
          highestStreak: 0,
        },
      },
      coins: 3,
    });
  });

  it('returns ecosystem and active subreddit sections on Hub', async () => {
    const caller = createCaller(makeCtx());
    const result = await caller.leaderboard.getPage({});

    expect(result.isHub).toBe(true);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]?.scope).toEqual({ kind: 'ecosystem' });
    expect(result.sections[0]?.title).toBe('Global Leaderboard');
    expect(result.sections[0]?.entries[0]?.highestStreak).toBe(0);
    expect(result.sections[1]?.scope).toEqual({
      kind: 'subreddit',
      subredditName: 'askreddit',
    });
    expect(mockGetEcosystemLeaderboardDisplayPage).toHaveBeenCalledWith(10, 'u1');
  });

  it('returns only the global section for logged-out Hub users', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));
    const result = await caller.leaderboard.getPage({});

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.scope).toEqual({ kind: 'ecosystem' });
    expect(mockGetEcosystemLeaderboardDisplayPage).toHaveBeenCalledWith(10, undefined);
  });

  it('returns a single all-time host section in community context', async () => {
    const caller = createCaller(
      makeCtx({
        subredditName: 'gaming',
        surface: 'community',
      })
    );

    const result = await caller.leaderboard.getPage({});

    expect(result.isHub).toBe(false);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.scope).toEqual({
      kind: 'subreddit',
      subredditName: 'gaming',
    });
    expect(mockGetLeaderboardDisplayPage).toHaveBeenCalledWith(
      { subredditName: 'gaming', timeframe: 'all' },
      10,
      'u1'
    );
  });

  it('passes through viewer-in-top-ten entries with highlight', async () => {
    const topTenWithViewer = makeTopTen().map((entry, index) =>
      index === 4
        ? { ...entry, userId: 'u1', username: 'viewer', isCurrentUser: true }
        : entry
    );
    mockGetEcosystemLeaderboardDisplayPage.mockResolvedValue(topTenWithViewer);

    const caller = createCaller(makeCtx());
    const result = await caller.leaderboard.getPage({});

    const entries = result.sections[0]?.entries ?? [];
    expect(entries).toHaveLength(10);
    expect(entries.filter((entry) => entry.isCurrentUser)).toHaveLength(1);
    expect(entries[4]?.username).toBe('viewer');
  });

  it('passes through appended viewer row when outside top ten', async () => {
    const topTen = makeTopTen();
    const appendedViewer = makeEntry({
      userId: 'u1',
      username: 'viewer',
      displayRank: 15,
      isCurrentUser: true,
    });
    mockGetEcosystemLeaderboardDisplayPage.mockResolvedValue([...topTen, appendedViewer]);

    const caller = createCaller(makeCtx());
    const result = await caller.leaderboard.getPage({});

    const entries = result.sections[0]?.entries ?? [];
    expect(entries).toHaveLength(11);
    expect(entries[10]?.isCurrentUser).toBe(true);
    expect(entries[10]?.displayRank).toBe(15);
    expect(entries.filter((entry) => entry.isCurrentUser)).toHaveLength(1);
  });

  it('returns top ten without viewer highlight for guests', async () => {
    mockGetEcosystemLeaderboardDisplayPage.mockResolvedValue(makeTopTen());

    const caller = createCaller(makeCtx({ userId: undefined }));
    const result = await caller.leaderboard.getPage({});

    const entries = result.sections[0]?.entries ?? [];
    expect(entries).toHaveLength(10);
    expect(entries.some((entry) => entry.isCurrentUser)).toBe(false);
  });
});
