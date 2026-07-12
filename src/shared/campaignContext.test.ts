import { describe, expect, it } from 'vitest';
import { campaignUsesRecentPlayGuard } from './campaignContext';

describe('campaignUsesRecentPlayGuard', () => {
  it('guards the Daily Challenge gauntlet', () => {
    expect(
      campaignUsesRecentPlayGuard({ subredditName: 'all', timeframe: 'all' })
    ).toBe(true);
  });

  it('guards now and day community campaigns', () => {
    expect(
      campaignUsesRecentPlayGuard({ subredditName: 'askreddit', timeframe: 'now' })
    ).toBe(true);
    expect(
      campaignUsesRecentPlayGuard({ subredditName: 'askreddit', timeframe: 'day' })
    ).toBe(true);
  });

  it('does not guard longer community timeframes', () => {
    expect(
      campaignUsesRecentPlayGuard({ subredditName: 'askreddit', timeframe: 'week' })
    ).toBe(false);
    expect(
      campaignUsesRecentPlayGuard({ subredditName: 'askreddit', timeframe: 'all' })
    ).toBe(false);
  });
});
