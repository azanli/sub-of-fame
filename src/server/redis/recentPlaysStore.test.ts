import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockZScore = vi.fn();
const mockZAdd = vi.fn();
const mockZRemRangeByScore = vi.fn();
const mockExpire = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    zScore: mockZScore,
    zAdd: mockZAdd,
    zRemRangeByScore: mockZRemRangeByScore,
    expire: mockExpire,
  },
}));

beforeEach(() => {
  mockZScore.mockReset();
  mockZAdd.mockReset();
  mockZRemRangeByScore.mockReset();
  mockExpire.mockReset();
});

const { hasRecentPlay, recordRecentPlay } = await import('./recentPlaysStore');
const { RECENT_PLAYS_TTL_S } = await import('./keys');

const WINDOW_MS = RECENT_PLAYS_TTL_S * 1000;
const NOW = 1_700_000_000_000;

describe('hasRecentPlay', () => {
  it('returns false when the member is missing', async () => {
    mockZScore.mockResolvedValue(undefined);
    expect(await hasRecentPlay('u1', 't3_abc', NOW)).toBe(false);
    expect(mockZScore).toHaveBeenCalledWith('user:u1:recent-plays', 't3_abc');
  });

  it('returns true when the score is within the window', async () => {
    mockZScore.mockResolvedValue(NOW - 1000);
    expect(await hasRecentPlay('u1', 't3_abc', NOW)).toBe(true);
  });

  it('returns false when the score is older than the window', async () => {
    mockZScore.mockResolvedValue(NOW - WINDOW_MS - 1);
    expect(await hasRecentPlay('u1', 't3_abc', NOW)).toBe(false);
  });
});

describe('recordRecentPlay', () => {
  it('adds the post, prunes stale members, and refreshes TTL', async () => {
    mockZAdd.mockResolvedValue(1);
    mockZRemRangeByScore.mockResolvedValue(0);
    mockExpire.mockResolvedValue(true);

    await recordRecentPlay('u1', 't3_abc', NOW);

    expect(mockZAdd).toHaveBeenCalledWith('user:u1:recent-plays', {
      score: NOW,
      member: 't3_abc',
    });
    expect(mockZRemRangeByScore).toHaveBeenCalledWith(
      'user:u1:recent-plays',
      0,
      NOW - WINDOW_MS - 1
    );
    expect(mockExpire).toHaveBeenCalledWith(
      'user:u1:recent-plays',
      RECENT_PLAYS_TTL_S
    );
  });
});
