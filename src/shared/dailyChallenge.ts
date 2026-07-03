// Single source of truth for the Daily Challenge's virtual "subreddit" identity.
// Both server (Redis keys, Reddit API calls) and client (dashboard routing) import
// this instead of hardcoding the 'all' literal, so the two can never drift.
export const DAILY_CHALLENGE_SUBREDDIT = 'all';

export const isDailyChallengeSubreddit = (subredditName: string): boolean =>
  subredditName === DAILY_CHALLENGE_SUBREDDIT;
