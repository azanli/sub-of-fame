import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockHGet = vi.fn();
const mockHGetAll = vi.fn();
const mockHSet = vi.fn();
const mockHDel = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    hGet: mockHGet,
    hGetAll: mockHGetAll,
    hSet: mockHSet,
    hDel: mockHDel,
  },
}));

beforeEach(() => {
  mockHGet.mockReset();
  mockHGetAll.mockReset();
  mockHSet.mockReset();
  mockHDel.mockReset();
});

const askredditAllCtx = { subredditName: 'askreddit', timeframe: 'all' as const };

const { getProgress, setProgress, incrementProgress, getAllProgress } = await import(
  './progressStore'
);

describe('getProgress', () => {
  it('returns 1 (default) when the hash field is missing (undefined)', async () => {
    mockHGet.mockResolvedValue(undefined);
    expect(await getProgress('u1', askredditAllCtx)).toBe(1);
  });

  it('returns the parsed integer when a stored value exists', async () => {
    mockHGet.mockResolvedValue('7');
    expect(await getProgress('u1', askredditAllCtx)).toBe(7);
  });

  it('returns 1 for a non-numeric stored value (defensive default)', async () => {
    mockHGet.mockResolvedValue('NaN');
    expect(await getProgress('u1', askredditAllCtx)).toBe(1);
  });

  it('uses the composite progress field', async () => {
    mockHGet.mockResolvedValue('3');
    await getProgress('u1', askredditAllCtx);
    expect(mockHGet).toHaveBeenCalledWith('user:u1:progress', 'askreddit:all');
  });

  it('lazy-migrates legacy subreddit-only fields for all timeframe', async () => {
    mockHGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce('9');
    expect(await getProgress('u1', askredditAllCtx)).toBe(9);
    expect(mockHGet).toHaveBeenNthCalledWith(1, 'user:u1:progress', 'askreddit:all');
    expect(mockHGet).toHaveBeenNthCalledWith(2, 'user:u1:progress', 'askreddit');
  });
});

describe('setProgress', () => {
  it('calls hSet with stringified rankIndex on the composite field', async () => {
    mockHSet.mockResolvedValue(1);
    mockHDel.mockResolvedValue(1);
    await setProgress('u1', askredditAllCtx, 5);
    expect(mockHSet).toHaveBeenCalledWith('user:u1:progress', { 'askreddit:all': '5' });
    expect(mockHDel).toHaveBeenCalledWith('user:u1:progress', ['askreddit']);
  });
});

describe('incrementProgress', () => {
  it('writes rank 2 when the hash field is missing (first advance from default rank 1)', async () => {
    mockHGet.mockResolvedValue(undefined);
    mockHSet.mockResolvedValue(1);
    mockHDel.mockResolvedValue(1);

    const result = await incrementProgress('u1', askredditAllCtx);

    expect(mockHSet).toHaveBeenCalledWith('user:u1:progress', { 'askreddit:all': '2' });
    expect(result).toBe(2);
  });

  it('increments from the current stored rankIndex', async () => {
    mockHGet.mockResolvedValue('3');
    mockHSet.mockResolvedValue(1);
    mockHDel.mockResolvedValue(1);
    const result = await incrementProgress('u1', askredditAllCtx);
    expect(mockHSet).toHaveBeenCalledWith('user:u1:progress', { 'askreddit:all': '4' });
    expect(result).toBe(4);
  });
});

describe('getAllProgress', () => {
  it('returns an empty object when no progress hash exists (empty record)', async () => {
    mockHGetAll.mockResolvedValue({});
    expect(await getAllProgress('u1')).toEqual({});
  });

  it('parses composite fields into nested timeframe maps', async () => {
    mockHGetAll.mockResolvedValue({ 'askreddit:all': '3', 'gaming:week': '10' });
    expect(await getAllProgress('u1')).toEqual({
      askreddit: { all: 3 },
      gaming: { week: 10 },
    });
  });

  it('maps legacy subreddit-only fields to all timeframe', async () => {
    mockHGetAll.mockResolvedValue({ askreddit: 'bad' });
    expect(await getAllProgress('u1')).toEqual({ askreddit: { all: 1 } });
  });
});
