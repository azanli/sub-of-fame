import type { RedditClient } from '@devvit/reddit';
import type { T5 } from '@devvit/shared-types/tid.js';
import {
  CURATED_SUBREDDITS,
  normalizeSubredditDisplayName,
} from '../../shared/subreddits';
import { isDailyChallengeSubreddit } from '../../shared/dailyChallenge';
import type { SubredditDisplayMetadata } from '../../shared/api';
import { getMetadata, setMetadata } from '../redis/metadataStore';
import { METADATA_TTL_S } from '../redis/keys';
import type { SubredditMetadataCacheEntry } from '../redis/types';

const APP_FALLBACK_ICON_URL =
  'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png';
const DAILY_CHALLENGE_ICON_URL = '/fame-icon.png';

type Reddit = Pick<RedditClient, 'getSubredditInfoByName' | 'getSubredditStyles'>;

const isInaccessibleSubredditType = (type: string | undefined): boolean =>
  type === 'private' || type === 'restricted';

const resolveIconUrl = async (reddit: Reddit, subredditId: T5 | undefined): Promise<string> => {
  if (!subredditId) {
    return APP_FALLBACK_ICON_URL;
  }

  try {
    const styles = await reddit.getSubredditStyles(subredditId);
    return styles.icon ?? APP_FALLBACK_ICON_URL;
  } catch {
    return APP_FALLBACK_ICON_URL;
  }
};

export const resolveSubredditMetadata = async (
  subredditName: string,
  reddit: Reddit
): Promise<SubredditDisplayMetadata | null> => {
  // r/all is a virtual, platform-wide feed rather than a real subreddit — calling
  // getSubredditInfoByName for it would fail, so it's resolved locally like a curated entry.
  if (isDailyChallengeSubreddit(subredditName)) {
    return {
      subreddit: subredditName,
      displayName: subredditName,
      iconUrl: DAILY_CHALLENGE_ICON_URL,
      metadataSource: 'curated',
    };
  }

  const curated = CURATED_SUBREDDITS.find((entry) => entry.name === subredditName);
  if (curated) {
    return {
      subreddit: subredditName,
      displayName: curated.displayName,
      iconUrl: curated.iconUrl,
      metadataSource: 'curated',
    };
  }

  const cached = await getMetadata(subredditName);
  if (cached) {
    return {
      subreddit: subredditName,
      displayName: normalizeSubredditDisplayName(cached.displayName),
      iconUrl: cached.iconUrl,
      metadataSource: 'reddit',
    };
  }

  try {
    const info = await reddit.getSubredditInfoByName(subredditName);
    if (!info) {
      return null;
    }

    if (isInaccessibleSubredditType(info.type) || info.isQuarantined) {
      return null;
    }

    const displayName = normalizeSubredditDisplayName(info.name ?? subredditName);
    const iconUrl = await resolveIconUrl(reddit, info.id);

    const entry: SubredditMetadataCacheEntry = {
      subreddit: subredditName,
      displayName,
      iconUrl,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + METADATA_TTL_S * 1000,
    };
    await setMetadata(subredditName, entry);

    return {
      subreddit: subredditName,
      displayName,
      iconUrl,
      metadataSource: 'reddit',
    };
  } catch {
    return null;
  }
};
