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

type Reddit = Pick<
  RedditClient,
  'getSubredditInfoByName' | 'getSubredditStyles'
>;

const isInaccessibleSubredditType = (type: string | undefined): boolean =>
  type === 'private' || type === 'restricted';

const hasUsableIsNsfw = (
  cached: SubredditMetadataCacheEntry
): cached is SubredditMetadataCacheEntry & { isNsfw: boolean } =>
  typeof cached.isNsfw === 'boolean';

const resolveIconUrl = async (
  reddit: Reddit,
  subredditId: T5 | undefined
): Promise<string> => {
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
      isNsfw: false,
      metadataSource: 'curated',
    };
  }

  const curated = CURATED_SUBREDDITS.find(
    (entry) => entry.name === subredditName
  );
  if (curated) {
    return {
      subreddit: subredditName,
      displayName: curated.subreddit,
      iconUrl: curated.iconUrl,
      isNsfw: false,
      metadataSource: 'curated',
    };
  }

  const cached = await getMetadata(subredditName);
  // Stale cache entries written before isNsfw existed must be re-fetched so NSFW
  // communities are not stuck with the post NSFW gate for the remainder of the TTL.
  if (cached && hasUsableIsNsfw(cached)) {
    return {
      subreddit: subredditName,
      displayName: normalizeSubredditDisplayName(cached.displayName),
      iconUrl: cached.iconUrl,
      isNsfw: cached.isNsfw,
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

    const displayName = normalizeSubredditDisplayName(
      info.name ?? subredditName
    );
    const iconUrl = await resolveIconUrl(reddit, info.id);
    const isNsfw = info.isNsfw === true;

    const entry: SubredditMetadataCacheEntry = {
      subreddit: subredditName,
      displayName,
      iconUrl,
      isNsfw,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + METADATA_TTL_S * 1000,
    };
    await setMetadata(subredditName, entry);

    return {
      subreddit: subredditName,
      displayName,
      iconUrl,
      isNsfw,
      metadataSource: 'reddit',
    };
  } catch {
    return null;
  }
};
