import { redis } from '@devvit/web/server';
import type { UserStatsProfile } from '../../shared/api';
import {
  statsKey,
  statsCoinsField,
  statsGlobalCorrectField,
  statsGlobalTotalField,
  statsSubCorrectField,
  statsSubTotalField,
} from './keys';

/** Welcome balance granted once when a user has no coins field yet. */
export const WELCOME_COINS = 3;

/**
 * Compute Hive IQ from raw counters.
 * Returns null when totalSlots is 0 — not yet measured, distinct from 0% accuracy.
 * Returns 0 when totalSlots > 0 and correctSlots = 0 — measured, no correct slots.
 */
export const computeHiveIQ = (correctSlots: number, totalSlots: number): number | null => {
  if (totalSlots === 0) return null;
  return (correctSlots / totalSlots) * 100;
};

/**
 * Grant the welcome coin balance on first access. Idempotent for existing wallets.
 */
export const ensureWelcomeCoins = async (userId: string): Promise<number> => {
  const key = statsKey(userId);
  const field = statsCoinsField();
  const raw = await redis.hGet(key, field);
  if (raw !== undefined) {
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  await redis.hSet(key, { [field]: String(WELCOME_COINS) });
  return WELCOME_COINS;
};

/**
 * Increment stats counters atomically after a successful submit.
 * total always advances by 3 (one round = 3 slots); correct advances by score (0–3).
 * coins advance by score (0–3), matching correctly ranked slots.
 * Uses HINCRBY so missing fields start at 0 automatically.
 */
export const incrementStats = async (
  userId: string,
  subredditName: string,
  correctSlots: number
): Promise<number> => {
  const key = statsKey(userId);
  const [, , , , coins] = await Promise.all([
    redis.hIncrBy(key, statsGlobalCorrectField(), correctSlots),
    redis.hIncrBy(key, statsGlobalTotalField(), 3),
    redis.hIncrBy(key, statsSubCorrectField(subredditName), correctSlots),
    redis.hIncrBy(key, statsSubTotalField(subredditName), 3),
    redis.hIncrBy(key, statsCoinsField(), correctSlots),
  ]);

  return coins;
};

/**
 * Attempt to deduct one Karma Coin. Rolls back if the balance would go negative.
 */
export const deductCoin = async (
  userId: string
): Promise<{ ok: true; coins: number } | { ok: false }> => {
  const key = statsKey(userId);
  const field = statsCoinsField();
  const newBalance = await redis.hIncrBy(key, field, -1);
  if (newBalance < 0) {
    await redis.hIncrBy(key, field, 1);
    return { ok: false };
  }
  return { ok: true, coins: newBalance };
};

/**
 * Read all stats for a user and return them as a structured profile.
 * Counter fields that are absent default to 0.
 */
export const getStats = async (userId: string): Promise<UserStatsProfile> => {
  const fields = await redis.hGetAll(statsKey(userId));

  const parseField = (field: string): number => {
    const v = fields[field];
    if (v === undefined) return 0;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const bySubreddit: Record<string, { correctSlots: number; totalSlots: number }> = {};

  for (const field of Object.keys(fields)) {
    // Match sub:{subredditName}:(correct|total)
    const match = /^sub:(.+):(correct|total)$/.exec(field);
    if (!match) continue;
    const sub = match[1];
    const kind = match[2];
    if (sub === undefined || kind === undefined) continue;
    if (!bySubreddit[sub]) {
      bySubreddit[sub] = { correctSlots: 0, totalSlots: 0 };
    }
    if (kind === 'correct') {
      bySubreddit[sub].correctSlots = parseField(field);
    } else {
      bySubreddit[sub].totalSlots = parseField(field);
    }
  }

  return {
    global: {
      correctSlots: parseField(statsGlobalCorrectField()),
      totalSlots: parseField(statsGlobalTotalField()),
    },
    bySubreddit,
    coins: parseField(statsCoinsField()),
  };
};
