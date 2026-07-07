import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../trpc';
import type { LeaderboardEntry } from '../../shared/api';

const {
  mockGetEcosystemLeaderboardPage,
  mockGetEcosystemLeaderboardRank,
  mockGetLeaderboardPage,
  mockGetLeaderboardRank,
  mockListProgressEntries,
  mockGetStats,
  mockResolveSubredditMetadata,
} = vi.hoisted(() => ({
  mockGetEcosystemLeaderboardPage: vi.fn(),
  mockGetEcosystemLeaderboardRank: vi.fn(),
  mockGetLeaderboardPage: vi.fn(),
  mockGetLeaderboardRank: vi.fn(),
  mockListProgressEntries: vi.fn(),
  mockGetStats: vi.fn(),
  mockResolveSubredditMetadata: vi.fn(),
}));

vi.mock('../redis/leaderboardStore.js', () => ({
  updateLeaderboard: vi.fn(),
  getLeaderboardPage: mockGetLeaderboardPage,
  getLeaderboardRank: mockGetLeaderboardRank,
  getEcosystemLeaderboardPage: mockGetEcosystemLeaderboardPage,
  getEcosystemLeaderboardRank: mockGetEcosystemLeaderboardRank,
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
  displayRank: 1,
  isCurrentUser: true,
  ...overrides,
});

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
      metadataSource: 'curated' as const,
    }));
    mockGetEcosystemLeaderboardPage.mockResolvedValue([makeEntry()]);
    mockGetEcosystemLeaderboardRank.mockResolvedValue(1);
    mockGetLeaderboardPage.mockResolvedValue([makeEntry({ username: 'beta', isCurrentUser: false })]);
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
    expect(result.sections[1]?.scope).toEqual({
      kind: 'subreddit',
      subredditName: 'askreddit',
    });
  });

  it('returns only the global section for logged-out Hub users', async () => {
    const caller = createCaller(makeCtx({ userId: undefined }));
    const result = await caller.leaderboard.getPage({});

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.scope).toEqual({ kind: 'ecosystem' });
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
    expect(mockGetLeaderboardPage).toHaveBeenCalledWith(
      { subredditName: 'gaming', timeframe: 'all' },
      0,
      25,
      'u1'
    );
  });
});
