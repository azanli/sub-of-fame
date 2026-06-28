import type { LaunchContext } from '../shared/api';
import { HUB_SUBREDDITS } from './config';

export const HUB_SUBREDDIT = 'suboffame' as const;

export const normalizeSubredditName = (value: string): string =>
  value.trim().replace(/^r\//i, '').toLowerCase();

/**
 * Derive Reddit launch surface from Devvit context when the SDK does not expose it
 * directly. Community-feed embeds carry a postId; profile/inbox/DM launches do not.
 */
export const resolveRedditSurface = (ctx: { postId?: string | undefined }): string =>
  ctx.postId ? 'community' : 'profile';

export const deriveLaunchContext = (
  rawHostSubreddit: string,
  redditSurface: string = 'community'
): LaunchContext => {
  const hostSubreddit = normalizeSubredditName(rawHostSubreddit);

  if (redditSurface !== 'community') {
    return { surface: 'hub', hostSubreddit: HUB_SUBREDDIT };
  }

  if (HUB_SUBREDDITS.has(hostSubreddit)) {
    return { surface: 'hub', hostSubreddit: HUB_SUBREDDIT };
  }

  return { surface: 'community', hostSubreddit };
};

export type SubredditMatchResult =
  | { ok: true; subreddit: string }
  | { ok: false; code: 'SUBREDDIT_REQUIRED' | 'HOST_SUBREDDIT_LOCKED' };

export const resolveRequestedSubreddit = (
  launchContext: LaunchContext,
  requestedSubreddit: string | undefined
): SubredditMatchResult => {
  if (launchContext.surface === 'hub') {
    if (!requestedSubreddit) {
      return { ok: false, code: 'SUBREDDIT_REQUIRED' };
    }

    return { ok: true, subreddit: normalizeSubredditName(requestedSubreddit) };
  }

  if (!requestedSubreddit) {
    return { ok: true, subreddit: launchContext.hostSubreddit };
  }

  const normalizedRequest = normalizeSubredditName(requestedSubreddit);

  if (normalizedRequest !== launchContext.hostSubreddit) {
    return { ok: false, code: 'HOST_SUBREDDIT_LOCKED' };
  }

  return { ok: true, subreddit: launchContext.hostSubreddit };
};
