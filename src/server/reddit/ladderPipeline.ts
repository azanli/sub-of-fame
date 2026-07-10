import type { Listing, Post, RedditClient } from '@devvit/reddit';
import type { T3 } from '@devvit/shared-types/tid.js';
import type { CampaignContext } from '../../shared/campaignContext.js';
import type { NextWorkBudget } from '../../shared/api.js';
import {
  resolveCampaignLadderPageSize,
  resolveRedditListingStrategy,
} from '../redis/campaignKeys.js';
import { resolvePostPlainText } from './postContent.js';
import {
  getCursorChain,
  getLadderPage,
  rankIndexToOffset,
  rankIndexToPage,
  setCursorChain,
  setLadderPage,
} from '../redis/ladderStore.js';
import type {
  LadderCachePage,
  LadderCursorChain,
  LadderPostSummary,
} from '../redis/types.js';

type Reddit = Pick<RedditClient, 'getTopPosts' | 'getHotPosts'>;

export type LadderResolveResult =
  | { kind: 'hit'; page: LadderCachePage; offset: number }
  | { kind: 'exhausted' }
  | { kind: 'unplayable'; continuationRankIndex: number }
  | { kind: 'error'; message: string };

export const canSpendRedditCall = (budget: NextWorkBudget): boolean =>
  budget.redditCallsRemaining > 0 && Date.now() < budget.softDeadlineAt;

export const spendRedditCall = (budget: NextWorkBudget): void => {
  budget.redditCallsRemaining -= 1;
};

const isSelfPost = (post: Post): boolean =>
  post.url.includes('reddit.com') && post.url.includes('/comments/');

export const toPostUrl = (post: Post): string => {
  if (isSelfPost(post)) {
    return post.url;
  }

  const { permalink } = post;
  return permalink.startsWith('http')
    ? permalink
    : `https://www.reddit.com${permalink}`;
};

export const resolveLadderPostUrl = (post: LadderPostSummary): string =>
  post.postUrl ||
  `https://www.reddit.com/comments/${post.id.replace(/^t3_/, '')}/`;

/** Matches `GalleryMediaStatus.FAILED` from the Devvit Post model. */
const GALLERY_MEDIA_FAILED = 2;
const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif|webp)$/i;
const REDDIT_IMAGE_HOST_PATTERN =
  /^https:\/\/(i|preview|external-preview)\.redd\.it\//i;
const LOW_RES_THUMB_HOST_PATTERN = /thumbs\.redditmedia\.com/i;

// --- THE FIX: Remove external-preview from the rewrite set ---
const REDDIT_PREVIEW_HOSTS = new Set([
  'preview.redd.it',
  // 'external-preview.redd.it' is intentionally excluded.
  // We cannot map external caches to i.redd.it.
]);
// -------------------------------------------------------------

/** Converts signed preview URLs into direct i.redd.it links the webview can load. */
export const toLoadableRedditImageUrl = (url: string): string => {
  const normalized = url.replace(/&amp;/g, '&').trim();

  try {
    const parsed = new URL(normalized);
    // This will now ONLY trigger for native 'preview.redd.it' files
    if (REDDIT_PREVIEW_HOSTS.has(parsed.hostname)) {
      return `https://i.redd.it${parsed.pathname}`;
    }
    // For external-preview and thumbs.redditmedia, return the fully intact URL
    return parsed.toString();
  } catch {
    return normalized;
  }
};

export const upgradeRedditImageUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === 'preview.redd.it' ||
      parsed.hostname === 'external-preview.redd.it'
    ) {
      parsed.searchParams.delete('width');
      parsed.searchParams.delete('crop');
      return parsed.toString();
    }
  } catch {
    return url;
  }

  return url;
};

/** Upgrades preview URLs and converts them into direct i.redd.it links the webview can load. */
export const resolveLoadableImageUrl = (url: string): string =>
  toLoadableRedditImageUrl(upgradeRedditImageUrl(url));

export const isLowResImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (LOW_RES_THUMB_HOST_PATTERN.test(parsed.hostname)) {
      return true;
    }

    if (
      (parsed.hostname === 'preview.redd.it' ||
        parsed.hostname === 'external-preview.redd.it') &&
      parsed.searchParams.has('width')
    ) {
      const width = Number(parsed.searchParams.get('width'));
      return Number.isFinite(width) && width <= 640;
    }
  } catch {
    return false;
  }

  return false;
};

const isDirectImageUrl = (url: string): boolean => {
  if (REDDIT_IMAGE_HOST_PATTERN.test(url)) {
    return true;
  }

  try {
    const { pathname } = new URL(url);
    return IMAGE_EXTENSION_PATTERN.test(pathname);
  } catch {
    return false;
  }
};

export const normalizeGalleryImageUrls = (post: Post): string[] => {
  const urls: string[] = [];
  for (const item of post.gallery) {
    if (item.status !== GALLERY_MEDIA_FAILED && item.url.length > 0) {
      urls.push(toLoadableRedditImageUrl(item.url));
    }
  }
  return urls;
};

const pickLongerGalleryList = (
  fetched: string[],
  cached: string[]
): string[] => (fetched.length >= cached.length ? fetched : cached);

const getGalleryImageUrl = (post: Post): string | undefined =>
  normalizeGalleryImageUrls(post)[0];

const getThumbnailUrl = (post: Post): string | undefined => post.thumbnail?.url;

/** Direct .mp4 URL for reddit-hosted videos (v.redd.it), suitable for a plain <video> tag. */
export const getVideoFallbackUrl = (post: Post): string | undefined =>
  post.secureMedia?.redditVideo?.fallbackUrl;

export const normalizeImageUrl = (post: Post): string | undefined => {
  if (isSelfPost(post)) {
    return undefined;
  }

  const galleryUrl = getGalleryImageUrl(post);
  if (galleryUrl !== undefined) {
    return galleryUrl;
  }

  if (post.url && isDirectImageUrl(post.url)) {
    return resolveLoadableImageUrl(post.url);
  }

  // --- THE FIX: Deep Preview Extraction ---
  // Safely cast to 'any' to bypass Devvit's Post type obscuring the preview object
  const anyPost = post as any;
  const deepPreviewUrl = anyPost.preview?.images?.[0]?.source?.url;

  if (typeof deepPreviewUrl === 'string' && deepPreviewUrl.length > 0) {
    return resolveLoadableImageUrl(deepPreviewUrl);
  }
  // ----------------------------------------

  const thumbnail = getThumbnailUrl(post);

  // Expanded filtering to catch 'nsfw' and 'spoiler' literal strings
  if (
    thumbnail &&
    thumbnail !== 'default' &&
    thumbnail !== 'self' &&
    thumbnail !== 'nsfw' &&
    thumbnail !== 'spoiler'
  ) {
    return resolveLoadableImageUrl(thumbnail);
  }

  return undefined;
};

type PostLookupReddit = Pick<RedditClient, 'getPostById'>;

export const resolvePostImageUrl = async (
  cachedUrl: string | undefined,
  postId: T3,
  reddit: PostLookupReddit
): Promise<string | undefined> => {
  if (cachedUrl !== undefined) {
    const upgraded = upgradeRedditImageUrl(cachedUrl);
    if (!isLowResImageUrl(upgraded)) {
      return resolveLoadableImageUrl(upgraded);
    }
  }

  try {
    const post = await reddit.getPostById(postId);
    const normalized = normalizeImageUrl(post);
    if (normalized !== undefined && !isLowResImageUrl(normalized)) {
      return normalized;
    }

    const enriched = await post.getEnrichedThumbnail();
    if (enriched?.image.url !== undefined) {
      return resolveLoadableImageUrl(enriched.image.url);
    }
  } catch {
    // Fall back to the cached URL when enrichment fails.
  }

  if (cachedUrl !== undefined) {
    return resolveLoadableImageUrl(cachedUrl);
  }

  return undefined;
};

export const resolvePostGalleryUrls = async (
  cachedUrls: string[] | undefined,
  postId: T3,
  reddit: PostLookupReddit
): Promise<string[] | undefined> => {
  const cachedLoadable =
    cachedUrls?.map(toLoadableRedditImageUrl).filter((url) => url.length > 0) ??
    [];

  try {
    const post = await reddit.getPostById(postId);
    const fetchedUrls = normalizeGalleryImageUrls(post);
    const urls = pickLongerGalleryList(fetchedUrls, cachedLoadable);

    if (urls.length > 0) {
      try {
        const enriched = await post.getEnrichedThumbnail();
        if (enriched?.image.url !== undefined) {
          urls[0] = toLoadableRedditImageUrl(enriched.image.url);
        }
      } catch {
        // Fall back to the first gallery URL when enrichment fails.
      }
      return urls;
    }
  } catch {
    // Fall back to cached gallery URLs when enrichment fails.
  }

  if (cachedLoadable.length > 0) {
    return cachedLoadable;
  }

  return undefined;
};

export const buildPostSummary = (post: Post): LadderPostSummary => {
  const plainText = resolvePostPlainText(post);
  const summary: LadderPostSummary = {
    id: post.id,
    title: post.title,
    postUrl: toPostUrl(post),
    sourceSubredditName: post.subredditName,
    hasBody: plainText.length >= 50,
    isNSFW: post.nsfw,
    isSpoiler: post.spoiler,
    commentCount: post.numberOfComments ?? 0,
  };

  // --- THE FIX: Detect External News/Article Links ---
  // If it is not a text post and the URL isn't a direct media file, it is a link post.
  if (!isSelfPost(post) && post.url) {
    const isDirectImage = isDirectImageUrl(post.url);
    if (!isDirectImage && getVideoFallbackUrl(post) === undefined) {
      summary.linkUrl = post.url;
      try {
        // Extract a clean domain name (e.g., "telegraph.co.uk")
        summary.linkDomain = new URL(post.url).hostname.replace(/^www\./, '');
      } catch {
        summary.linkDomain = post.url;
      }
    }
  }
  // ---------------------------------------------------

  const videoUrl = getVideoFallbackUrl(post);
  if (videoUrl !== undefined) {
    summary.imageUrl = videoUrl;
    summary.isVideo = true;
    return summary;
  }

  const galleryUrls = normalizeGalleryImageUrls(post);
  if (galleryUrls.length > 0) {
    summary.galleryUrls = galleryUrls;
    summary.imageUrl = galleryUrls[0];
  } else {
    const imageUrl = normalizeImageUrl(post);
    if (imageUrl !== undefined) {
      summary.imageUrl = imageUrl;
    }
  }

  return summary;
};

export const fastFilterEligible = (summary: LadderPostSummary): boolean => {
  if (summary.isNSFW || summary.isSpoiler) {
    return false;
  }
  if (summary.title.length < 10 && !summary.hasBody) {
    return false;
  }
  if (summary.commentCount < 10) {
    return false;
  }
  return true;
};

type MutableCursorChain = LadderCursorChain;

const emptyChain = (ctx: CampaignContext): MutableCursorChain => ({
  subreddit: ctx.subredditName,
  timeframe: ctx.timeframe,
  startsAfter: {},
  deepestKnownPage: 0,
  terminalPage: null,
  updatedAt: Date.now(),
});

const normalizeChain = (
  ctx: CampaignContext,
  chain: LadderCursorChain | null
): MutableCursorChain => {
  if (chain === null) {
    return emptyChain(ctx);
  }
  if (
    chain.subreddit !== ctx.subredditName ||
    chain.timeframe !== ctx.timeframe
  ) {
    return emptyChain(ctx);
  }
  return chain;
};

const hasStartsAfter = (chain: MutableCursorChain, page: number): boolean =>
  Object.hasOwn(chain.startsAfter, page);

const extractListingAfter = (
  listing: Listing<Post>,
  posts: Post[]
): string | null => {
  if ('after' in listing) {
    const listingAfter = listing.after;
    if (typeof listingAfter === 'string') {
      return listingAfter;
    }
  }
  if (posts.length === 0) {
    return null;
  }
  return posts[posts.length - 1]!.id;
};

const resolveAfterCursor = async (
  ctx: CampaignContext,
  page: number,
  chain: MutableCursorChain,
  lastNextAfter: string | null
): Promise<string | null> => {
  if (hasStartsAfter(chain, page)) {
    return chain.startsAfter[page] ?? null;
  }
  if (page === 1) {
    return null;
  }
  if (lastNextAfter !== null) {
    return lastNextAfter;
  }
  const previousPage = await getLadderPage(ctx, page - 1);
  return previousPage?.nextAfter ?? null;
};

type FetchPageResult =
  | {
      kind: 'ok';
      page: LadderCachePage;
      nextAfter: string | null;
      isTerminal: boolean;
    }
  | { kind: 'terminal'; page: LadderCachePage };

const fetchListing = (
  ctx: CampaignContext,
  after: string | null,
  pageSize: number,
  reddit: Reddit
): Listing<Post> => {
  const strategy = resolveRedditListingStrategy(ctx);
  if (strategy.kind === 'hot') {
    return reddit.getHotPosts({
      subredditName: ctx.subredditName,
      after: after ?? undefined,
      limit: pageSize,
    });
  }

  return reddit.getTopPosts({
    subredditName: ctx.subredditName,
    after: after ?? undefined,
    limit: pageSize,
    timeframe: strategy.timeframe,
  });
};

const fetchAndPersistPage = async (
  ctx: CampaignContext,
  page: number,
  after: string | null,
  budget: NextWorkBudget,
  reddit: Reddit,
  chain: MutableCursorChain
): Promise<FetchPageResult> => {
  const pageSize = resolveCampaignLadderPageSize(ctx);
  const listing = fetchListing(ctx, after, pageSize, reddit);
  const posts = await listing.get(pageSize);
  spendRedditCall(budget);

  const isTerminal = posts.length < pageSize || !listing.hasMore;
  const nextAfter = isTerminal ? null : extractListingAfter(listing, posts);

  const cachePage: LadderCachePage = {
    page,
    startsAfter: after,
    nextAfter,
    posts: posts.map(buildPostSummary),
    fetchedAt: Date.now(),
  };

  await setLadderPage(ctx, page, cachePage);

  chain.subreddit = ctx.subredditName;
  chain.timeframe = ctx.timeframe;
  chain.startsAfter[page] = after;
  if (nextAfter !== null) {
    chain.startsAfter[page + 1] = nextAfter;
  }
  chain.deepestKnownPage = Math.max(chain.deepestKnownPage, page);
  if (isTerminal) {
    chain.terminalPage = page;
  }
  chain.updatedAt = Date.now();
  await setCursorChain(ctx, chain);

  if (isTerminal) {
    return { kind: 'terminal', page: cachePage };
  }
  return { kind: 'ok', page: cachePage, nextAfter, isTerminal: false };
};

export const resolveLadderPage = async (
  ctx: CampaignContext,
  rankIndex: number,
  budget: NextWorkBudget,
  reddit: Reddit
): Promise<LadderResolveResult> => {
  if (rankIndex < 1) {
    return { kind: 'error', message: 'rankIndex must be >= 1' };
  }

  const targetPage = rankIndexToPage(rankIndex, ctx);
  const offset = rankIndexToOffset(rankIndex, ctx);

  const cachedPage = await getLadderPage(ctx, targetPage);
  if (cachedPage !== null) {
    return { kind: 'hit', page: cachedPage, offset };
  }

  const loadedChain = await getCursorChain(ctx);
  const chain = normalizeChain(ctx, loadedChain);

  if (hasStartsAfter(chain, targetPage)) {
    if (!canSpendRedditCall(budget)) {
      return { kind: 'unplayable', continuationRankIndex: rankIndex };
    }

    const after = chain.startsAfter[targetPage] ?? null;
    let fetchResult: FetchPageResult;
    try {
      fetchResult = await fetchAndPersistPage(
        ctx,
        targetPage,
        after,
        budget,
        reddit,
        chain
      );
    } catch (error) {
      return {
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'failed to fetch ladder page',
      };
    }

    if (fetchResult.kind === 'terminal') {
      return { kind: 'hit', page: fetchResult.page, offset };
    }

    return { kind: 'hit', page: fetchResult.page, offset };
  }

  let lastNextAfter: string | null = null;
  for (let page = chain.deepestKnownPage + 1; page <= targetPage; page += 1) {
    if (!canSpendRedditCall(budget)) {
      return { kind: 'unplayable', continuationRankIndex: rankIndex };
    }

    const after = await resolveAfterCursor(ctx, page, chain, lastNextAfter);
    let fetchResult: FetchPageResult;
    try {
      fetchResult = await fetchAndPersistPage(
        ctx,
        page,
        after,
        budget,
        reddit,
        chain
      );
    } catch (error) {
      return {
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'failed to fetch ladder page',
      };
    }

    if (fetchResult.kind === 'terminal') {
      if (page < targetPage) {
        return { kind: 'exhausted' };
      }
      return { kind: 'hit', page: fetchResult.page, offset };
    }

    lastNextAfter = fetchResult.nextAfter;
    if (page === targetPage) {
      return { kind: 'hit', page: fetchResult.page, offset };
    }
  }

  return { kind: 'error', message: 'failed to resolve ladder page' };
};
