import { describe, expect, it } from 'vitest';
import {
  progressKey,
  dailyProgressKey,
  statsKey,
  leaderboardKey,
  metadataKey,
  ladderPageKey,
  ladderCursorsKey,
  snapshotKey,
  attemptKey,
  submitLockKey,
  statsGlobalCorrectField,
  statsGlobalTotalField,
  statsSubCorrectField,
  statsSubTotalField,
  statsCoinsField,
  METADATA_TTL_S,
  LADDER_PAGE_TTL_S,
  LADDER_CURSORS_TTL_S,
  SNAPSHOT_TTL_S,
  ATTEMPT_TTL_S,
  SUBMIT_LOCK_TTL_S,
  DAILY_LADDER_PAGE_TTL_S,
  DAILY_PROGRESS_TTL_S,
  STANDARD_LADDER_PAGE_SIZE,
  DAILY_LADDER_PAGE_SIZE,
  resolveLadderPageTtlS,
  resolveLadderPageSize,
  resolveLadderTimeframe,
} from './keys';

describe('key builders', () => {
  it('progressKey builds the correct key string', () => {
    expect(progressKey('u123')).toBe('user:u123:progress');
  });

  it('statsKey builds the correct key string', () => {
    expect(statsKey('u123')).toBe('user:u123:stats');
  });

  it('leaderboardKey builds the correct key string', () => {
    expect(leaderboardKey('askreddit')).toBe('leaderboard:askreddit');
  });

  it('metadataKey builds the correct key string', () => {
    expect(metadataKey('askreddit')).toBe('sub:metadata:askreddit');
  });

  it('ladderPageKey builds the correct key string', () => {
    expect(ladderPageKey('gaming', 1)).toBe('sub:ladder:gaming:1');
    expect(ladderPageKey('gaming', 5)).toBe('sub:ladder:gaming:5');
  });

  it('ladderCursorsKey builds the correct key string', () => {
    expect(ladderCursorsKey('gaming')).toBe('sub:ladder:gaming:cursors');
  });

  it('snapshotKey builds the correct key string', () => {
    expect(snapshotKey('t3_abc123')).toBe('puzzle:snapshot:t3_abc123');
  });

  it('attemptKey builds the correct key string', () => {
    expect(attemptKey('attempt-uuid')).toBe('puzzle:attempt:attempt-uuid');
  });

  it('submitLockKey builds the correct key string', () => {
    expect(submitLockKey('attempt-uuid')).toBe('puzzle:submit-lock:attempt-uuid');
  });

  it('leaderboardKey and ladderCursorsKey do not collide for the same subreddit', () => {
    expect(leaderboardKey('gaming')).not.toBe(ladderCursorsKey('gaming'));
  });

  it('dailyProgressKey builds the correct key string, isolated from progressKey', () => {
    expect(dailyProgressKey('u123', '2026-07-02')).toBe('user:u123:daily-progress:2026-07-02');
    expect(dailyProgressKey('u123', '2026-07-02')).not.toBe(progressKey('u123'));
  });
});

describe('stats field builders', () => {
  it('statsGlobalCorrectField returns global:correct', () => {
    expect(statsGlobalCorrectField()).toBe('global:correct');
  });

  it('statsGlobalTotalField returns global:total', () => {
    expect(statsGlobalTotalField()).toBe('global:total');
  });

  it('statsSubCorrectField builds the correct field', () => {
    expect(statsSubCorrectField('askreddit')).toBe('sub:askreddit:correct');
  });

  it('statsSubTotalField builds the correct field', () => {
    expect(statsSubTotalField('askreddit')).toBe('sub:askreddit:total');
  });

  it('statsCoinsField returns coins', () => {
    expect(statsCoinsField()).toBe('coins');
  });
});

describe('TTL constants', () => {
  it('METADATA_TTL_S is 7 days in seconds', () => {
    expect(METADATA_TTL_S).toBe(7 * 24 * 60 * 60);
  });

  it('LADDER_PAGE_TTL_S is 7 days in seconds', () => {
    expect(LADDER_PAGE_TTL_S).toBe(7 * 24 * 60 * 60);
  });

  it('LADDER_CURSORS_TTL_S is 30 days in seconds', () => {
    expect(LADDER_CURSORS_TTL_S).toBe(30 * 24 * 60 * 60);
  });

  it('SNAPSHOT_TTL_S is 7 days in seconds', () => {
    expect(SNAPSHOT_TTL_S).toBe(7 * 24 * 60 * 60);
  });

  it('ATTEMPT_TTL_S is 1 hour in seconds', () => {
    expect(ATTEMPT_TTL_S).toBe(3600);
  });

  it('SUBMIT_LOCK_TTL_S matches ATTEMPT_TTL_S', () => {
    expect(SUBMIT_LOCK_TTL_S).toBe(ATTEMPT_TTL_S);
  });

  it('LADDER_CURSORS_TTL_S is longer than LADDER_PAGE_TTL_S', () => {
    expect(LADDER_CURSORS_TTL_S).toBeGreaterThan(LADDER_PAGE_TTL_S);
  });

  it('DAILY_LADDER_PAGE_TTL_S is 2 hours in seconds', () => {
    expect(DAILY_LADDER_PAGE_TTL_S).toBe(2 * 60 * 60);
  });

  it('DAILY_LADDER_PAGE_TTL_S is far shorter than LADDER_PAGE_TTL_S', () => {
    expect(DAILY_LADDER_PAGE_TTL_S).toBeLessThan(LADDER_PAGE_TTL_S);
  });

  it('DAILY_PROGRESS_TTL_S is 2 days in seconds', () => {
    expect(DAILY_PROGRESS_TTL_S).toBe(2 * 24 * 60 * 60);
  });
});

describe('ladder pipeline policy resolvers', () => {
  it('resolveLadderPageTtlS returns the aggressive TTL for the Daily Challenge subreddit', () => {
    expect(resolveLadderPageTtlS('all')).toBe(DAILY_LADDER_PAGE_TTL_S);
  });

  it('resolveLadderPageTtlS returns the durable TTL for any other subreddit', () => {
    expect(resolveLadderPageTtlS('askreddit')).toBe(LADDER_PAGE_TTL_S);
  });

  it('resolveLadderPageSize returns 50 for the Daily Challenge subreddit', () => {
    expect(resolveLadderPageSize('all')).toBe(DAILY_LADDER_PAGE_SIZE);
  });

  it('resolveLadderPageSize returns 100 for any other subreddit', () => {
    expect(resolveLadderPageSize('askreddit')).toBe(STANDARD_LADDER_PAGE_SIZE);
  });

  it("resolveLadderTimeframe returns 'day' for the Daily Challenge subreddit", () => {
    expect(resolveLadderTimeframe('all')).toBe('day');
  });

  it("resolveLadderTimeframe returns 'all' for any other subreddit", () => {
    expect(resolveLadderTimeframe('askreddit')).toBe('all');
  });
});
