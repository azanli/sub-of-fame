import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockHGet = vi.fn();
const mockHGetAll = vi.fn();
const mockHSet = vi.fn();
const mockHIncrBy = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    hGet: mockHGet,
    hGetAll: mockHGetAll,
    hSet: mockHSet,
    hIncrBy: mockHIncrBy,
  },
}));

beforeEach(() => {
  mockHGet.mockReset();
  mockHGetAll.mockReset();
  mockHSet.mockReset();
  mockHIncrBy.mockReset();
});

const { getProgress, setProgress, incrementProgress, getAllProgress } = await import(
  './progressStore'
);

describe('getProgress', () => {
  it('returns 1 (default) when the hash field is missing (undefined)', async () => {
    mockHGet.mockResolvedValue(undefined);
    expect(await getProgress('u1', 'askreddit')).toBe(1);
  });

  it('returns the parsed integer when a stored value exists', async () => {
    mockHGet.mockResolvedValue('7');
    expect(await getProgress('u1', 'askreddit')).toBe(7);
  });

  it('returns 1 for a non-numeric stored value (defensive default)', async () => {
    mockHGet.mockResolvedValue('NaN');
    expect(await getProgress('u1', 'askreddit')).toBe(1);
  });

  it('uses the correct key and field', async () => {
    mockHGet.mockResolvedValue('3');
    await getProgress('u1', 'gaming');
    expect(mockHGet).toHaveBeenCalledWith('user:u1:progress', 'gaming');
  });
});

describe('setProgress', () => {
  it('calls hSet with stringified rankIndex', async () => {
    mockHSet.mockResolvedValue(1);
    await setProgress('u1', 'gaming', 5);
    expect(mockHSet).toHaveBeenCalledWith('user:u1:progress', { gaming: '5' });
  });
});

describe('incrementProgress', () => {
  it('writes rank 2 when the hash field is missing (first advance from default rank 1)', async () => {
    mockHGet.mockResolvedValue(undefined);
    mockHSet.mockResolvedValue(1);

    const result = await incrementProgress('u1', 'gaming');

    expect(mockHSet).toHaveBeenCalledWith('user:u1:progress', { gaming: '2' });
    expect(mockHIncrBy).not.toHaveBeenCalled();
    expect(result).toBe(2);
  });

  it('calls hIncrBy with +1 and returns the new value when progress exists', async () => {
    mockHGet.mockResolvedValue('3');
    mockHIncrBy.mockResolvedValue(4);
    const result = await incrementProgress('u1', 'gaming');
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:progress', 'gaming', 1);
    expect(mockHSet).not.toHaveBeenCalled();
    expect(result).toBe(4);
  });
});

describe('getAllProgress', () => {
  it('returns an empty object when no progress hash exists (empty record)', async () => {
    mockHGetAll.mockResolvedValue({});
    expect(await getAllProgress('u1')).toEqual({});
  });

  it('parses all fields and returns a subreddit→rankIndex map', async () => {
    mockHGetAll.mockResolvedValue({ askreddit: '3', gaming: '10' });
    expect(await getAllProgress('u1')).toEqual({ askreddit: 3, gaming: 10 });
  });

  it('defaults non-numeric fields to 1', async () => {
    mockHGetAll.mockResolvedValue({ askreddit: 'bad' });
    expect(await getAllProgress('u1')).toEqual({ askreddit: 1 });
  });
});
