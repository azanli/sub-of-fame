import { describe, expect, it } from 'vitest';
import {
  progressKey,
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
  METADATA_TTL_S,
  LADDER_PAGE_TTL_S,
  LADDER_CURSORS_TTL_S,
  SNAPSHOT_TTL_S,
  ATTEMPT_TTL_S,
  SUBMIT_LOCK_TTL_S,
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
});
