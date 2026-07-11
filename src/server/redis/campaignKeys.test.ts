import { describe, expect, it } from 'vitest';
import type { CampaignContext } from '../../shared/campaignContext';
import {
  campaignLeaderboardKey,
  campaignLadderCursorsKey,
  campaignLadderPageKey,
  legacyLeaderboardKey,
  parseProgressField,
  progressField,
  resolveCampaignLadderPageSize,
  resolveCampaignLadderPageTtlS,
  resolveRedditListingStrategy,
  statsCampaignCorrectField,
  statsCampaignTotalField,
  statsSubredditCorrectField,
  statsSubredditCurrentStreakField,
  statsSubredditHighestStreakField,
  statsSubredditTotalField,
  DAY_LADDER_PAGE_TTL_S,
  NOW_LADDER_PAGE_TTL_S,
} from './campaignKeys';
import { LADDER_PAGE_TTL_S } from './keys';

const ctx = (subredditName: string, timeframe: CampaignContext['timeframe']): CampaignContext => ({
  subredditName,
  timeframe,
});

describe('progressField', () => {
  it('builds subreddit:timeframe composite fields', () => {
    expect(progressField(ctx('funny', 'month'))).toBe('funny:month');
    expect(progressField(ctx('askreddit', 'all'))).toBe('askreddit:all');
  });
});

describe('parseProgressField', () => {
  it('parses composite fields', () => {
    expect(parseProgressField('funny:month')).toEqual({
      subredditName: 'funny',
      timeframe: 'month',
    });
  });

  it('maps legacy subreddit-only fields to all timeframe', () => {
    expect(parseProgressField('askreddit')).toEqual({
      subredditName: 'askreddit',
      timeframe: 'all',
    });
  });

  it('returns null for invalid timeframe segments', () => {
    expect(parseProgressField('funny:invalid')).toBeNull();
  });
});

describe('campaign key builders', () => {
  it('campaignLeaderboardKey includes timeframe', () => {
    expect(campaignLeaderboardKey(ctx('funny', 'week'))).toBe('leaderboard:funny:week');
  });

  it('legacyLeaderboardKey preserves old shape', () => {
    expect(legacyLeaderboardKey('funny')).toBe('leaderboard:funny');
  });

  it('campaignLeaderboardKey does not collide with ladder cursors', () => {
    const campaign = ctx('gaming', 'all');
    expect(campaignLeaderboardKey(campaign)).not.toBe(campaignLadderCursorsKey(campaign));
  });

  it('campaignLadderPageKey includes timeframe and page', () => {
    expect(campaignLadderPageKey(ctx('funny', 'now'), 1)).toBe('sub:ladder:funny:now:1');
    expect(campaignLadderPageKey(ctx('funny', 'all'), 3)).toBe('sub:ladder:funny:all:3');
  });

  it('campaignLadderCursorsKey includes timeframe', () => {
    expect(campaignLadderCursorsKey(ctx('funny', 'day'))).toBe('sub:ladder:funny:day:cursors');
  });
});

describe('stats field builders', () => {
  it('statsCampaignCorrectField includes timeframe', () => {
    expect(statsCampaignCorrectField(ctx('funny', 'month'))).toBe('sub:funny:month:correct');
  });

  it('statsCampaignTotalField includes timeframe', () => {
    expect(statsCampaignTotalField(ctx('funny', 'month'))).toBe('sub:funny:month:total');
  });

  it('statsSubredditCorrectField is rollup without timeframe', () => {
    expect(statsSubredditCorrectField('funny')).toBe('sub:funny:correct');
  });

  it('statsSubredditTotalField is rollup without timeframe', () => {
    expect(statsSubredditTotalField('funny')).toBe('sub:funny:total');
  });

  it('statsSubredditCurrentStreakField builds the subreddit streak current field', () => {
    expect(statsSubredditCurrentStreakField('funny')).toBe('sub:funny:streak:current');
  });

  it('statsSubredditHighestStreakField builds the subreddit streak highest field', () => {
    expect(statsSubredditHighestStreakField('funny')).toBe('sub:funny:streak:highest');
  });
});

describe('resolveCampaignLadderPageTtlS', () => {
  it('returns short TTL for now campaigns', () => {
    expect(resolveCampaignLadderPageTtlS(ctx('funny', 'now'))).toBe(NOW_LADDER_PAGE_TTL_S);
  });

  it('returns durable TTL for all-time campaigns', () => {
    expect(resolveCampaignLadderPageTtlS(ctx('funny', 'all'))).toBe(LADDER_PAGE_TTL_S);
  });

  it('returns daily-challenge TTL for the all subreddit regardless of timeframe', () => {
    expect(resolveCampaignLadderPageTtlS(ctx('all', 'all'))).toBe(DAY_LADDER_PAGE_TTL_S);
  });
});

describe('resolveCampaignLadderPageSize', () => {
  it('returns 50 for Daily Challenge subreddit', () => {
    expect(resolveCampaignLadderPageSize(ctx('all', 'day'))).toBe(50);
  });

  it('returns 100 for community subreddits', () => {
    expect(resolveCampaignLadderPageSize(ctx('funny', 'month'))).toBe(100);
  });
});

describe('resolveRedditListingStrategy', () => {
  it('uses hot listing for now timeframe', () => {
    expect(resolveRedditListingStrategy(ctx('funny', 'now'))).toEqual({ kind: 'hot' });
  });

  it('maps all timeframe to top/all', () => {
    expect(resolveRedditListingStrategy(ctx('funny', 'all'))).toEqual({
      kind: 'top',
      timeframe: 'all',
    });
  });

  it('uses day top listing for Daily Challenge subreddit', () => {
    expect(resolveRedditListingStrategy(ctx('all', 'all'))).toEqual({
      kind: 'top',
      timeframe: 'day',
    });
  });
});
