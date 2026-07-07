import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockHIncrBy = vi.fn();
const mockHGetAll = vi.fn();
const mockHGet = vi.fn();
const mockHSet = vi.fn();

vi.mock('@devvit/web/server', () => ({
  redis: {
    hIncrBy: mockHIncrBy,
    hGetAll: mockHGetAll,
    hGet: mockHGet,
    hSet: mockHSet,
  },
}));

beforeEach(() => {
  mockHIncrBy.mockReset();
  mockHGetAll.mockReset();
  mockHGet.mockReset();
  mockHSet.mockReset();
});

const {
  WELCOME_COINS,
  computeHiveIQ,
  deductCoin,
  deductCoins,
  ensureWelcomeCoins,
  getGameMode,
  incrementStats,
  getStats,
  setGameMode,
} = await import('./statsStore');

const gamingAllCtx = { subredditName: 'gaming', timeframe: 'all' as const };
const askredditAllCtx = { subredditName: 'askreddit', timeframe: 'all' as const };

describe('computeHiveIQ', () => {
  it('returns null when totalSlots is 0 (not yet measured)', () => {
    expect(computeHiveIQ(0, 0)).toBeNull();
  });

  it('clamps weak measured performance to the floor', () => {
    expect(computeHiveIQ(0, 3)).toBe(70);
  });

  it('maps random-guesser accuracy to 100', () => {
    expect(computeHiveIQ(3, 9)).toBe(100);
  });

  it('returns 150 for 2/3 accuracy over three rounds', () => {
    expect(computeHiveIQ(6, 9)).toBe(150);
  });

  it('clamps perfect accuracy to the ceiling', () => {
    expect(computeHiveIQ(9, 9)).toBe(160);
  });
});

describe('ensureWelcomeCoins', () => {
  it('returns the existing balance without writing when coins already exist', async () => {
    mockHGet.mockResolvedValue('7');
    const coins = await ensureWelcomeCoins('u1');

    expect(coins).toBe(7);
    expect(mockHSet).not.toHaveBeenCalled();
  });

  it('grants the welcome balance when the field is missing', async () => {
    mockHGet.mockResolvedValue(undefined);
    const coins = await ensureWelcomeCoins('u1');

    expect(coins).toBe(WELCOME_COINS);
    expect(mockHSet).toHaveBeenCalledWith('user:u1:stats', {
      coins: String(WELCOME_COINS),
    });
  });
});

describe('getGameMode', () => {
  it('returns DEFAULT_GAME_MODE when the field is missing', async () => {
    mockHGet.mockResolvedValue(undefined);
    await expect(getGameMode('u1')).resolves.toBe('casual');
    expect(mockHGet).toHaveBeenCalledWith('user:u1:stats', 'gameMode');
  });

  it('returns stored expert mode when valid', async () => {
    mockHGet.mockResolvedValue('expert');
    await expect(getGameMode('u1')).resolves.toBe('expert');
  });

  it('falls back to DEFAULT_GAME_MODE for invalid stored values', async () => {
    mockHGet.mockResolvedValue('hardcore');
    await expect(getGameMode('u1')).resolves.toBe('casual');
  });
});

describe('setGameMode', () => {
  it('writes the mode to the stats hash', async () => {
    await setGameMode('u1', 'expert');
    expect(mockHSet).toHaveBeenCalledWith('user:u1:stats', { gameMode: 'expert' });
  });
});

describe('incrementStats', () => {
  it('calls hIncrBy for campaign, rollup, global, and coin fields', async () => {
    mockHIncrBy.mockResolvedValue(3);
    const coins = await incrementStats('u1', gamingAllCtx, {
      correctSlots: 2,
      coinAward: 2,
    });

    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'global:correct', 2);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'global:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'sub:gaming:all:correct', 2);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'sub:gaming:all:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'sub:gaming:correct', 2);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'sub:gaming:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'coins', 2);
    expect(mockHIncrBy).toHaveBeenCalledTimes(7);
    expect(coins).toBe(3);
  });

  it('increments total by 3 regardless of correctSlots (0 score round)', async () => {
    mockHIncrBy.mockResolvedValue(0);
    await incrementStats('u1', askredditAllCtx, { correctSlots: 0, coinAward: 0 });

    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'global:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'sub:askreddit:all:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'sub:askreddit:total', 3);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'global:correct', 0);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'coins', 0);
  });

  it('decouples Hive IQ correctSlots from coinAward for casual consolation tiers', async () => {
    mockHIncrBy.mockResolvedValue(4);
    await incrementStats('u1', gamingAllCtx, { correctSlots: 0, coinAward: 1 });

    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'global:correct', 0);
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'coins', 1);
  });
});

describe('deductCoins', () => {
  it('returns the new balance when the wallet has enough coins', async () => {
    mockHIncrBy.mockResolvedValueOnce(75);
    const result = await deductCoins('u1', 25);

    expect(result).toEqual({ ok: true, coins: 75 });
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'coins', -25);
    expect(mockHIncrBy).toHaveBeenCalledTimes(1);
  });

  it('rolls back and returns ok:false when the wallet is too low', async () => {
    mockHIncrBy.mockResolvedValueOnce(-5).mockResolvedValueOnce(20);
    const result = await deductCoins('u1', 25);

    expect(result).toEqual({ ok: false });
    expect(mockHIncrBy).toHaveBeenNthCalledWith(1, 'user:u1:stats', 'coins', -25);
    expect(mockHIncrBy).toHaveBeenNthCalledWith(2, 'user:u1:stats', 'coins', 25);
  });
});

describe('deductCoin', () => {
  it('returns the new balance when the wallet has coins', async () => {
    mockHIncrBy.mockResolvedValueOnce(2);
    const result = await deductCoin('u1');

    expect(result).toEqual({ ok: true, coins: 2 });
    expect(mockHIncrBy).toHaveBeenCalledWith('user:u1:stats', 'coins', -1);
    expect(mockHIncrBy).toHaveBeenCalledTimes(1);
  });

  it('rolls back and returns ok:false when the wallet is empty', async () => {
    mockHIncrBy.mockResolvedValueOnce(-1).mockResolvedValueOnce(0);
    const result = await deductCoin('u1');

    expect(result).toEqual({ ok: false });
    expect(mockHIncrBy).toHaveBeenNthCalledWith(1, 'user:u1:stats', 'coins', -1);
    expect(mockHIncrBy).toHaveBeenNthCalledWith(2, 'user:u1:stats', 'coins', 1);
  });
});

describe('getStats', () => {
  it('returns zero-defaulted profile when no stats exist (empty record)', async () => {
    mockHGetAll.mockResolvedValue({});
    const stats = await getStats('u1');
    expect(stats.global.correctSlots).toBe(0);
    expect(stats.global.totalSlots).toBe(0);
    expect(stats.coins).toBe(0);
    expect(stats.bySubreddit).toEqual({});
  });

  it('parses rollup and per-campaign counters correctly', async () => {
    mockHGetAll.mockResolvedValue({
      'global:correct': '5',
      'global:total': '9',
      'sub:gaming:correct': '3',
      'sub:gaming:total': '6',
      'sub:gaming:all:correct': '3',
      'sub:gaming:all:total': '6',
      'sub:askreddit:correct': '2',
      'sub:askreddit:total': '3',
      coins: '12',
    });
    const stats = await getStats('u1');
    expect(stats.global).toEqual({ correctSlots: 5, totalSlots: 9 });
    expect(stats.bySubreddit['gaming']).toEqual({
      aggregate: { correctSlots: 3, totalSlots: 6 },
      byTimeframe: {
        all: { correctSlots: 3, totalSlots: 6 },
      },
    });
    expect(stats.bySubreddit['askreddit']).toEqual({
      aggregate: { correctSlots: 2, totalSlots: 3 },
      byTimeframe: {},
    });
    expect(stats.coins).toBe(12);
  });

  it('defaults malformed counter values to 0', async () => {
    mockHGetAll.mockResolvedValue({ 'global:correct': 'NaN', 'global:total': '6' });
    const stats = await getStats('u1');
    expect(stats.global.correctSlots).toBe(0);
    expect(stats.global.totalSlots).toBe(6);
  });
});
