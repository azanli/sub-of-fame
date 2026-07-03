import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGetProgress = vi.fn();
const mockIncrementProgress = vi.fn();
const mockGetDailyProgress = vi.fn();
const mockIncrementDailyProgress = vi.fn();

vi.mock('./progressStore', () => ({
  getProgress: mockGetProgress,
  incrementProgress: mockIncrementProgress,
}));

vi.mock('./dailyChallengeStore', () => ({
  getDailyProgress: mockGetDailyProgress,
  incrementDailyProgress: mockIncrementDailyProgress,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const { getRankIndex, advanceRankIndex } = await import('./rankProgress');

describe('getRankIndex', () => {
  it('delegates to the daily challenge store for the all subreddit', async () => {
    mockGetDailyProgress.mockResolvedValue(4);

    const result = await getRankIndex('u1', 'all');

    expect(result).toBe(4);
    expect(mockGetDailyProgress).toHaveBeenCalledWith('u1');
    expect(mockGetProgress).not.toHaveBeenCalled();
  });

  it('delegates to the persistent progress store for any other subreddit', async () => {
    mockGetProgress.mockResolvedValue(7);

    const result = await getRankIndex('u1', 'askreddit');

    expect(result).toBe(7);
    expect(mockGetProgress).toHaveBeenCalledWith('u1', 'askreddit');
    expect(mockGetDailyProgress).not.toHaveBeenCalled();
  });
});

describe('advanceRankIndex', () => {
  it('delegates to the daily challenge store for the all subreddit', async () => {
    mockIncrementDailyProgress.mockResolvedValue(5);

    const result = await advanceRankIndex('u1', 'all');

    expect(result).toBe(5);
    expect(mockIncrementDailyProgress).toHaveBeenCalledWith('u1');
    expect(mockIncrementProgress).not.toHaveBeenCalled();
  });

  it('delegates to the persistent progress store for any other subreddit', async () => {
    mockIncrementProgress.mockResolvedValue(8);

    const result = await advanceRankIndex('u1', 'askreddit');

    expect(result).toBe(8);
    expect(mockIncrementProgress).toHaveBeenCalledWith('u1', 'askreddit');
    expect(mockIncrementDailyProgress).not.toHaveBeenCalled();
  });
});
