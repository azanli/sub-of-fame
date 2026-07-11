import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockZScore = vi.fn();
const mockZAdd = vi.fn();
const mockZRange = vi.fn();
const mockZCard = vi.fn();
const mockHGetAll = vi.fn();
const mockHGet = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    zScore: mockZScore,
    zAdd: mockZAdd,
    zRange: mockZRange,
    zCard: mockZCard,
    hGetAll: mockHGetAll,
    hGet: mockHGet,
  },
}));

const askredditAllCtx = { subredditName: 'askreddit', timeframe: 'all' as const };

const {
  updateLeaderboard,
  getLeaderboardPage,
  getLeaderboardRank,
  getEcosystemLeaderboardPage,
  getLeaderboardDisplayPage,
} = await import('./leaderboardStore.js');

beforeEach(() => {
  mockZScore.mockReset();
  mockZAdd.mockReset();
  mockZRange.mockReset();
  mockZCard.mockReset();
  mockHGetAll.mockReset();
  mockHGet.mockReset();

  mockZCard.mockResolvedValue(1);
  mockZRange.mockImplementation(async (key, min, max, options) => {
    if (options?.reverse === true) {
      if (key === 'leaderboard:askreddit:all') {
        return [
          { member: 'u1', score: 10 },
          { member: 'u2', score: 10 },
          { member: 'u3', score: 5 },
        ].slice(min, max + 1);
      }
      if (key === 'leaderboard:ecosystem') {
        return [{ member: 'u1', score: 20 }];
      }
    }

    if (min === 10 && max === 10) {
      return [
        { member: 'u1', score: 10 },
        { member: 'u2', score: 10 },
      ];
    }

    if (min === 11) {
      return [];
    }

    return [];
  });

  mockHGetAll.mockImplementation(async (key: string) => {
    if (key === 'user:u1:stats') {
      return { 'sub:askreddit:correct': '9', 'sub:askreddit:total': '9' };
    }
    if (key === 'user:u2:stats') {
      return { 'sub:askreddit:correct': '6', 'sub:askreddit:total': '9' };
    }
    if (key === 'user:u3:stats') {
      return { 'sub:askreddit:correct': '3', 'sub:askreddit:total': '9' };
    }
    return {};
  });

  mockHGet.mockResolvedValue(undefined);
});

describe('updateLeaderboard', () => {
  it('updates campaign and ecosystem scores incrementally', async () => {
    mockZScore.mockImplementation(async (key: string) => {
      if (key === 'leaderboard:askreddit:all') {
        return 4;
      }
      if (key === 'leaderboard:ecosystem') {
        return 12;
      }
      return undefined;
    });

    await updateLeaderboard(askredditAllCtx, 'u1', 10);

    expect(mockZAdd).toHaveBeenCalledWith('leaderboard:askreddit:all', {
      score: 10,
      member: 'u1',
    });
    expect(mockZAdd).toHaveBeenCalledWith('leaderboard:ecosystem', {
      score: 18,
      member: 'u1',
    });
  });

  it('skips writes when the cleared rank is not an improvement', async () => {
    mockZScore.mockResolvedValue(12);

    await updateLeaderboard(askredditAllCtx, 'u1', 10);

    expect(mockZAdd).not.toHaveBeenCalled();
  });
});

describe('getLeaderboardPage', () => {
  it('orders tied primary scores by Hive IQ descending', async () => {
    mockHGet.mockImplementation(async (key: string, field: string) => {
      if (field !== 'username') {
        return undefined;
      }
      if (key === 'user:u1:profile') {
        return 'alpha';
      }
      if (key === 'user:u2:profile') {
        return 'beta';
      }
      if (key === 'user:u3:profile') {
        return 'gamma';
      }
      return undefined;
    });

    const entries = await getLeaderboardPage(askredditAllCtx, 0, 3, 'u2');

    expect(entries.map((entry) => entry.userId)).toEqual(['u1', 'u2', 'u3']);
    expect(entries[0]?.displayRank).toBe(1);
    expect(entries[1]?.displayRank).toBe(1);
    expect(entries[2]?.displayRank).toBe(3);
    expect(entries[1]?.isCurrentUser).toBe(true);
  });
});

describe('getLeaderboardRank', () => {
  it('returns 1 when the user leads after tie-break ordering', async () => {
    mockZScore.mockResolvedValue(10);
    mockHGetAll.mockImplementation(async (key: string) => {
      if (key === 'user:u1:stats') {
        return { 'sub:askreddit:correct': '9', 'sub:askreddit:total': '9' };
      }
      if (key === 'user:u2:stats') {
        return { 'sub:askreddit:correct': '6', 'sub:askreddit:total': '9' };
      }
      return {};
    });

    const rank = await getLeaderboardRank(askredditAllCtx, 'u1');

    expect(rank).toBe(1);
  });
});

describe('getEcosystemLeaderboardPage', () => {
  it('hydrates global stats for ecosystem rows', async () => {
    mockZRange.mockImplementation(async (key, min, max, options) => {
      if (key === 'leaderboard:ecosystem' && options?.reverse === true) {
        return [{ member: 'u1', score: 20 }];
      }
      return [];
    });
    mockHGetAll.mockResolvedValue({
      'global:correct': '6',
      'global:total': '9',
      'streak:highest': '7',
    });
    mockHGet.mockResolvedValue('alpha');

    const entries = await getEcosystemLeaderboardPage(0, 1, 'u1');

    expect(entries).toHaveLength(1);
    expect(entries[0]?.bestClearedRankIndex).toBe(20);
    expect(entries[0]?.userSubredditHiveIQ).toBe(150);
    expect(entries[0]?.highestStreak).toBe(7);
    expect(entries[0]?.username).toBe('alpha');
  });
});

describe('getLeaderboardPage streak hydration', () => {
  it('uses per-subreddit highest streak for subreddit leaderboard rows', async () => {
    mockHGetAll.mockImplementation(async (key: string) => {
      if (key === 'user:u1:stats') {
        return {
          'sub:askreddit:correct': '9',
          'sub:askreddit:total': '9',
          'streak:highest': '99',
          'sub:askreddit:streak:highest': '4',
        };
      }
      if (key === 'user:u2:stats') {
        return {
          'sub:askreddit:correct': '6',
          'sub:askreddit:total': '9',
          'sub:askreddit:streak:highest': '2',
        };
      }
      if (key === 'user:u3:stats') {
        return {
          'sub:askreddit:correct': '3',
          'sub:askreddit:total': '9',
        };
      }
      return {};
    });
    mockHGet.mockImplementation(async (key: string, field: string) => {
      if (field !== 'username') {
        return undefined;
      }
      if (key === 'user:u1:profile') {
        return 'alpha';
      }
      if (key === 'user:u2:profile') {
        return 'beta';
      }
      if (key === 'user:u3:profile') {
        return 'gamma';
      }
      return undefined;
    });

    const entries = await getLeaderboardPage(askredditAllCtx, 0, 3, 'u2');

    expect(entries[0]?.highestStreak).toBe(4);
    expect(entries[1]?.highestStreak).toBe(2);
    expect(entries[2]?.highestStreak).toBe(0);
  });
});

describe('getLeaderboardDisplayPage', () => {
  it('returns top entries without appending when the viewer is already included', async () => {
    mockHGet.mockImplementation(async (key: string, field: string) => {
      if (field !== 'username') {
        return undefined;
      }
      if (key === 'user:u1:profile') {
        return 'alpha';
      }
      if (key === 'user:u2:profile') {
        return 'beta';
      }
      if (key === 'user:u3:profile') {
        return 'gamma';
      }
      return undefined;
    });

    const entries = await getLeaderboardDisplayPage(askredditAllCtx, 3, 'u2');

    expect(entries).toHaveLength(3);
    expect(entries.some((entry) => entry.isCurrentUser)).toBe(true);
    expect(entries.filter((entry) => entry.isCurrentUser)).toHaveLength(1);
  });

  it('appends the viewer row when they are outside the top slice', async () => {
    mockZRange.mockImplementation(async (key, min, max, options) => {
      if (options?.reverse === true && key === 'leaderboard:askreddit:all') {
        return [
          { member: 'top-1', score: 20 },
          { member: 'top-2', score: 19 },
          { member: 'top-3', score: 18 },
        ].slice(min, max + 1);
      }

      if (min === 5 && max === 5) {
        return [{ member: 'u-viewer', score: 5 }];
      }

      if (min === 6) {
        return [
          { member: 'top-1', score: 20 },
          { member: 'top-2', score: 19 },
          { member: 'top-3', score: 18 },
        ];
      }

      return [];
    });

    mockZScore.mockImplementation(async (_key, userId: string) => {
      if (userId === 'u-viewer') {
        return 5;
      }
      return undefined;
    });

    mockHGetAll.mockImplementation(async (key: string) => {
      if (key.startsWith('user:top-')) {
        return { 'sub:askreddit:correct': '9', 'sub:askreddit:total': '9' };
      }
      if (key === 'user:u-viewer:stats') {
        return { 'sub:askreddit:correct': '3', 'sub:askreddit:total': '9' };
      }
      return {};
    });

    mockHGet.mockImplementation(async (key: string, field: string) => {
      if (field !== 'username') {
        return undefined;
      }
      if (key === 'user:top-1:profile') {
        return 'leader1';
      }
      if (key === 'user:top-2:profile') {
        return 'leader2';
      }
      if (key === 'user:top-3:profile') {
        return 'leader3';
      }
      if (key === 'user:u-viewer:profile') {
        return 'viewer';
      }
      return undefined;
    });

    const entries = await getLeaderboardDisplayPage(askredditAllCtx, 3, 'u-viewer');

    expect(entries).toHaveLength(4);
    expect(entries[3]?.username).toBe('viewer');
    expect(entries[3]?.isCurrentUser).toBe(true);
    expect(entries[3]?.displayRank).toBe(4);
  });

  it('returns top entries only for guests', async () => {
    mockHGet.mockImplementation(async (key: string, field: string) => {
      if (field !== 'username') {
        return undefined;
      }
      if (key === 'user:u1:profile') {
        return 'alpha';
      }
      if (key === 'user:u2:profile') {
        return 'beta';
      }
      if (key === 'user:u3:profile') {
        return 'gamma';
      }
      return undefined;
    });

    const entries = await getLeaderboardDisplayPage(askredditAllCtx, 3, undefined);

    expect(entries).toHaveLength(3);
    expect(entries.some((entry) => entry.isCurrentUser)).toBe(false);
  });
});
