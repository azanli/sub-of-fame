import type { LaunchContext } from '../shared/api';

export const HUB_SUBREDDIT = 'suboffame' as const;

export const normalizeSubredditName = (value: string): string =>
  value.trim().replace(/^r\//i, '').toLowerCase();

export const deriveLaunchContext = (rawHostSubreddit: string): LaunchContext => {
  const hostSubreddit = normalizeSubredditName(rawHostSubreddit);

  if (hostSubreddit === HUB_SUBREDDIT) {
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
