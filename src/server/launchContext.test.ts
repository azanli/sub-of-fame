import { describe, expect, it } from 'vitest';
import {
  deriveLaunchContext,
  normalizeSubredditName,
  resolveRedditSurface,
  resolveRequestedSubreddit,
} from './launchContext';

describe('normalizeSubredditName', () => {
  it('lowercases plain names', () => {
    expect(normalizeSubredditName('AskReddit')).toBe('askreddit');
  });

  it('strips r/ prefix (lowercase)', () => {
    expect(normalizeSubredditName('r/AskReddit')).toBe('askreddit');
  });

  it('strips r/ prefix (uppercase)', () => {
    expect(normalizeSubredditName('R/AskReddit')).toBe('askreddit');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeSubredditName('  r/askreddit  ')).toBe('askreddit');
  });

  it('normalizes hub sentinel with r/ prefix', () => {
    expect(normalizeSubredditName('r/SubOfFame')).toBe('suboffame');
  });

  it('normalizes hub sentinel without prefix', () => {
    expect(normalizeSubredditName('SubOfFame')).toBe('suboffame');
  });
});

describe('deriveLaunchContext', () => {
  it('returns hub surface for normalized suboffame', () => {
    expect(deriveLaunchContext('suboffame')).toEqual({
      surface: 'hub',
      hostSubreddit: 'suboffame',
    });
  });

  it('returns hub surface for r/SubOfFame (case-insensitive prefix)', () => {
    expect(deriveLaunchContext('r/SubOfFame')).toEqual({
      surface: 'hub',
      hostSubreddit: 'suboffame',
    });
  });

  it('returns hub surface for SubOfFame (no prefix, mixed case)', () => {
    expect(deriveLaunchContext('SubOfFame')).toEqual({
      surface: 'hub',
      hostSubreddit: 'suboffame',
    });
  });

  it('returns community surface for any other subreddit', () => {
    expect(deriveLaunchContext('r/AskReddit')).toEqual({
      surface: 'community',
      hostSubreddit: 'askreddit',
    });
  });

  it('does not treat suboffame_extra as hub', () => {
    expect(deriveLaunchContext('suboffame_extra')).toEqual({
      surface: 'community',
      hostSubreddit: 'suboffame_extra',
    });
  });

  it('non-community surface (profile) with foreign sub resolves to hub', () => {
    expect(deriveLaunchContext('gaming', 'profile')).toEqual({
      surface: 'hub',
      hostSubreddit: 'suboffame',
    });
  });

  it('non-community surface (inbox) with foreign sub resolves to hub', () => {
    expect(deriveLaunchContext('askreddit', 'inbox')).toEqual({
      surface: 'hub',
      hostSubreddit: 'suboffame',
    });
  });

  it('community surface with suboffame still resolves to hub', () => {
    expect(deriveLaunchContext('suboffame', 'community')).toEqual({
      surface: 'hub',
      hostSubreddit: 'suboffame',
    });
  });

  it('community surface with foreign sub remains community', () => {
    expect(deriveLaunchContext('gaming', 'community')).toEqual({
      surface: 'community',
      hostSubreddit: 'gaming',
    });
  });
});

describe('resolveRedditSurface', () => {
  it('returns community when postId is present', () => {
    expect(resolveRedditSurface({ postId: 't3_abc123' })).toBe('community');
  });

  it('returns profile when postId is absent', () => {
    expect(resolveRedditSurface({})).toBe('profile');
  });
});

describe('resolveRequestedSubreddit', () => {
  const hubContext = { surface: 'hub' as const, hostSubreddit: 'suboffame' as const };
  const communityContext = { surface: 'community' as const, hostSubreddit: 'gaming' };

  it('hub: returns normalized requested subreddit when provided', () => {
    expect(resolveRequestedSubreddit(hubContext, 'r/AskReddit')).toEqual({
      ok: true,
      subreddit: 'askreddit',
    });
  });

  it('hub: returns SUBREDDIT_REQUIRED when subreddit is undefined', () => {
    expect(resolveRequestedSubreddit(hubContext, undefined)).toEqual({
      ok: false,
      code: 'SUBREDDIT_REQUIRED',
    });
  });

  it('community: uses hostSubreddit when no subreddit provided', () => {
    expect(resolveRequestedSubreddit(communityContext, undefined)).toEqual({
      ok: true,
      subreddit: 'gaming',
    });
  });

  it('community: accepts subreddit matching host (case-insensitive r/ prefix)', () => {
    expect(resolveRequestedSubreddit(communityContext, 'r/Gaming')).toEqual({
      ok: true,
      subreddit: 'gaming',
    });
  });

  it('community: rejects subreddit that does not match host', () => {
    expect(resolveRequestedSubreddit(communityContext, 'askreddit')).toEqual({
      ok: false,
      code: 'HOST_SUBREDDIT_LOCKED',
    });
  });
});
