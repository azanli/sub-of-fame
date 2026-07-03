// Dispatches rankIndex reads/writes to the correct backing store: the persistent
// per-subreddit campaign hash for ordinary subreddits, or the isolated, daily-resetting
// hash for the Daily Challenge (r/all). Route handlers should use these instead of
// importing progressStore/dailyChallengeStore directly, so the two stores never need to
// know about each other's existence.
import { isDailyChallengeSubreddit } from '../../shared/dailyChallenge';
import { getDailyProgress, incrementDailyProgress } from './dailyChallengeStore';
import { getProgress, incrementProgress } from './progressStore';

export const getRankIndex = (userId: string, subredditName: string): Promise<number> =>
  isDailyChallengeSubreddit(subredditName)
    ? getDailyProgress(userId)
    : getProgress(userId, subredditName);

export const advanceRankIndex = (userId: string, subredditName: string): Promise<number> =>
  isDailyChallengeSubreddit(subredditName)
    ? incrementDailyProgress(userId)
    : incrementProgress(userId, subredditName);
