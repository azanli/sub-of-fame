import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockDel = vi.fn();
const mockZRem = vi.fn();
const mockListProgressEntries = vi.fn();
const mockGetStats = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    del: mockDel,
    zRem: mockZRem,
  },
}));

vi.mock('./progressStore.js', () => ({
  listProgressEntries: mockListProgressEntries,
}));

vi.mock('./statsStore.js', () => ({
  getStats: mockGetStats,
}));

const FIXED_NOW = Date.UTC(2026, 6, 7, 12, 0, 0);

beforeEach(() => {
  vi.clearAllMocks();
  mockDel.mockResolvedValue(1);
  mockZRem.mockResolvedValue(1);
  mockListProgressEntries.mockResolvedValue([
    { subredditName: 'askreddit', timeframe: 'all', rankIndex: 5 },
  ]);
  mockGetStats.mockResolvedValue({
    global: { correctSlots: 3, totalSlots: 9 },
    bySubreddit: {
      customsub: {
        aggregate: { correctSlots: 1, totalSlots: 3 },
        byTimeframe: {},
        currentStreak: 0,
        highestStreak: 0,
      },
    },
    coins: 2,
  });
});

const { deleteAllUserData } = await import('./userDataStore.js');

describe('deleteAllUserData', () => {
  it('removes the user from ecosystem and per-subreddit leaderboards', async () => {
    await deleteAllUserData('u1');

    expect(mockZRem).toHaveBeenCalledWith('leaderboard:ecosystem', ['u1']);
    expect(mockZRem).toHaveBeenCalledWith('leaderboard:askreddit', ['u1']);
    expect(mockZRem).toHaveBeenCalledWith('leaderboard:customsub', ['u1']);
    expect(mockZRem).toHaveBeenCalledWith('leaderboard:askreddit:all', ['u1']);
    expect(mockZRem).toHaveBeenCalledWith('leaderboard:customsub:now', ['u1']);
  });

  it('deletes user-owned Redis keys including recent daily progress', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    await deleteAllUserData('u1');

    expect(mockDel).toHaveBeenCalledWith('user:u1:progress');
    expect(mockDel).toHaveBeenCalledWith('user:u1:stats');
    expect(mockDel).toHaveBeenCalledWith('user:u1:profile');
    expect(mockDel).toHaveBeenCalledWith('user:u1:daily-progress:2026-07-07');
    expect(mockDel).toHaveBeenCalledWith('user:u1:daily-progress:2026-07-06');
    expect(mockDel).toHaveBeenCalledWith('user:u1:daily-progress:2026-07-05');

    vi.useRealTimers();
  });

  it('still deletes core user keys when the player has no stored data', async () => {
    mockListProgressEntries.mockResolvedValue([]);
    mockGetStats.mockResolvedValue({
      global: { correctSlots: 0, totalSlots: 0 },
      bySubreddit: {},
      coins: 0,
    });

    await deleteAllUserData('u-empty');

    expect(mockZRem).toHaveBeenCalledWith('leaderboard:ecosystem', ['u-empty']);
    expect(mockDel).toHaveBeenCalledWith('user:u-empty:progress');
    expect(mockDel).toHaveBeenCalledWith('user:u-empty:stats');
    expect(mockDel).toHaveBeenCalledWith('user:u-empty:profile');
  });
});
