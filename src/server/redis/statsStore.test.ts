import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockHIncrBy = vi.fn();
const mockHGetAll = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    hIncrBy: mockHIncrBy,
    hGetAll: mockHGetAll,
  },
}));

beforeEach(() => {
  mockHIncrBy.mockReset();
  mockHGetAll.mockReset();
});

const { computeHiveIQ, incrementStats, getStats } = await import('./statsStore');

describe('computeHiveIQ', () => {
  it('returns null when totalSlots is 0 (not yet measured)', () => {
    expect(computeHiveIQ(0, 0)).toBeNull();
  });

  it('returns 0 when totalSlots > 0 and correctSlots is 0 (measured, no correct)', () => {
    expect(computeHiveIQ(0, 3)).toBe(0);
  });

  it('returns 100 for a perfect round (3/3)', () => {
    expect(computeHiveIQ(3, 3)).toBe(100);
  });

  it('returns ~66.7 for 2/3 correct', () => {
    expect(computeHiveIQ(2, 3)).toBeCloseTo(66.67, 1);
  });

  it('returns the ratio over multiple rounds', () => {
    // 2 rounds, 6 total slots, 5 correct
    expect(computeHiveIQ(5, 6)).toBeCloseTo(83.33, 1);
  });
});

describe('incrementStats', () => {
  it('calls hIncrBy for all 4 counter fields with correct amounts', async () => {
    mockHIncrBy.mockResolvedValue(3);
    await incrementStats('u1', 'gaming', 2);

    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'global:correct', 2);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'global:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'sub:gaming:correct', 2);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'sub:gaming:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledTimes(4);
  });

  it('increments total by 3 regardless of correctSlots (0 score round)', async () => {
    mockHIncrBy.mockResolvedValue(0);
    await incrementStats('u1', 'askreddit', 0);

    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'global:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'sub:askreddit:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'global:correct', 0);
  });
});

describe('getStats', () => {
  it('returns zero-defaulted profile when no stats exist (empty record)', async () => {
    mockHGetAll.mockResolvedValue({});
    const stats = await getStats('u1');
    expect(stats.global.correctSlots).toBe(0);
    expect(stats.global.totalSlots).toBe(0);
    expect(stats.bySubreddit).toEqual({});
  });

  it('parses global and per-subreddit counters correctly', async () => {
    mockHGetAll.mockResolvedValue({
      'global:correct': '5',
      'global:total': '9',
      'sub:gaming:correct': '3',
      'sub:gaming:total': '6',
      'sub:askreddit:correct': '2',
      'sub:askreddit:total': '3',
    });
    const stats = await getStats('u1');
    expect(stats.global).toEqual({ correctSlots: 5, totalSlots: 9 });
    expect(stats.bySubreddit['gaming']).toEqual({ correctSlots: 3, totalSlots: 6 });
    expect(stats.bySubreddit['askreddit']).toEqual({ correctSlots: 2, totalSlots: 3 });
  });

  it('defaults malformed counter values to 0', async () => {
    mockHGetAll.mockResolvedValue({ 'global:correct': 'NaN', 'global:total': '6' });
    const stats = await getStats('u1');
    expect(stats.global.correctSlots).toBe(0);
    expect(stats.global.totalSlots).toBe(6);
  });
});
