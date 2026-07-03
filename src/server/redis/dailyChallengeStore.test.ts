import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockHGet = vi.fn();
const mockHSet = vi.fn();
const mockHIncrBy = vi.fn();
const mockExpire = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    hGet: mockHGet,
    hSet: mockHSet,
    hIncrBy: mockHIncrBy,
    expire: mockExpire,
  },
}));

beforeEach(() => {
  mockHGet.mockReset();
  mockHSet.mockReset();
  mockHIncrBy.mockReset();
  mockExpire.mockReset();
});

const {
  currentUtcDateStamp,
  getDailyChallengeResetAt,
  getDailyProgress,
  incrementDailyProgress,
} = await import('./dailyChallengeStore');

describe('currentUtcDateStamp', () => {
  it('formats a UTC date as YYYY-MM-DD', () => {
    const utcNoon = Date.UTC(2026, 6, 2, 12, 0, 0);
    expect(currentUtcDateStamp(utcNoon)).toBe('2026-07-02');
  });
});

describe('getDailyChallengeResetAt', () => {
  it('returns the next UTC-midnight boundary, strictly after now', () => {
    const now = Date.UTC(2026, 6, 2, 15, 30, 0);
    const resetAt = getDailyChallengeResetAt(now);

    expect(resetAt).toBe(Date.UTC(2026, 6, 3, 0, 0, 0));
    expect(resetAt).toBeGreaterThan(now);
  });

  it('rolls to the following day when now is exactly UTC midnight', () => {
    const midnight = Date.UTC(2026, 6, 2, 0, 0, 0);
    expect(getDailyChallengeResetAt(midnight)).toBe(Date.UTC(2026, 6, 3, 0, 0, 0));
  });
});

describe('getDailyProgress', () => {
  it('returns 1 (default) when the hash field is missing (undefined)', async () => {
    mockHGet.mockResolvedValue(undefined);
    expect(await getDailyProgress('u1')).toBe(1);
  });

  it('returns the parsed integer when a stored value exists', async () => {
    mockHGet.mockResolvedValue('12');
    expect(await getDailyProgress('u1')).toBe(12);
  });

  it('returns 1 for a non-numeric stored value (defensive default)', async () => {
    mockHGet.mockResolvedValue('NaN');
    expect(await getDailyProgress('u1')).toBe(1);
  });

  it('reads from a hash key that embeds the current UTC date', async () => {
    mockHGet.mockResolvedValue('3');
    await getDailyProgress('u1');

    const [key, field] = mockHGet.mock.calls[0] as [string, string];
    expect(key).toMatch(/^user:u1:daily-progress:\d{4}-\d{2}-\d{2}$/);
    expect(field).toBe('all');
  });
});

describe('incrementDailyProgress', () => {
  it('writes rank 2 when the hash field is missing (first advance from default rank 1)', async () => {
    mockHGet.mockResolvedValue(undefined);
    mockHSet.mockResolvedValue(1);

    const result = await incrementDailyProgress('u1');

    expect(mockHSet).toHaveBeenCalledWith(expect.any(String), { all: '2' });
    expect(mockHIncrBy).not.toHaveBeenCalled();
    expect(result).toBe(2);
  });

  it('calls hIncrBy with +1 and returns the new value when progress exists', async () => {
    mockHGet.mockResolvedValue('5');
    mockHIncrBy.mockResolvedValue(6);

    const result = await incrementDailyProgress('u1');

    expect(mockHIncrBy).toHaveBeenCalledWith(expect.any(String), 'all', 1);
    expect(mockHSet).not.toHaveBeenCalled();
    expect(result).toBe(6);
  });

  it('refreshes the hash TTL on every write', async () => {
    mockHGet.mockResolvedValue('5');
    mockHIncrBy.mockResolvedValue(6);

    await incrementDailyProgress('u1');

    expect(mockExpire).toHaveBeenCalledWith(expect.any(String), 2 * 24 * 60 * 60);
  });
});
