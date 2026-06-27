import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockSet = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    set: mockSet,
  },
}));

beforeEach(() => {
  mockSet.mockReset();
});

const { acquireSubmitLock } = await import('./submitLockStore');

describe('acquireSubmitLock', () => {
  it('returns true when SET NX succeeds (returns OK)', async () => {
    mockSet.mockResolvedValue('OK');
    const result = await acquireSubmitLock('attempt-uuid');
    expect(result).toBe(true);
  });

  it('returns false when SET NX fails (key already exists, returns empty string)', async () => {
    mockSet.mockResolvedValue('');
    const result = await acquireSubmitLock('attempt-uuid');
    expect(result).toBe(false);
  });

  it('calls set with the correct key, value, and nx flag', async () => {
    mockSet.mockResolvedValue('OK');
    await acquireSubmitLock('my-attempt-id');

    expect(mockSet).toHaveBeenCalledOnce();
    const call = mockSet.mock.calls[0];
    const [key, value, options] = call as [string, string, { nx: boolean; expiration: Date }];
    expect(key).toBe('puzzle:submit-lock:my-attempt-id');
    expect(value).toBe('1');
    expect(options.nx).toBe(true);
    expect(options.expiration).toBeInstanceOf(Date);
  });

  it('sets expiration approximately SUBMIT_LOCK_TTL_S seconds in the future', async () => {
    mockSet.mockResolvedValue('OK');
    const before = Date.now();
    await acquireSubmitLock('attempt-uuid');
    const after = Date.now();

    const call2 = mockSet.mock.calls[0] as [string, string, { nx: boolean; expiration: Date }];
    const expMs = call2[2].expiration.getTime();

    // Expiration should be ~3600s from now (allow 1s clock slack in either direction)
    expect(expMs).toBeGreaterThanOrEqual(before + 3599_000);
    expect(expMs).toBeLessThanOrEqual(after + 3601_000);
  });

  it('returns false for any non-OK return value (defensive)', async () => {
    for (const val of [null, undefined, 'nil', '0']) {
      mockSet.mockResolvedValue(val);
      expect(await acquireSubmitLock('attempt-uuid')).toBe(false);
    }
  });
});
