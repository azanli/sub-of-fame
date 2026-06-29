import type { Listing, Post, RedditClient } from '@devvit/reddit';
import type { NextWorkBudget } from '../../shared/api.js';
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

type Reddit = Pick<RedditClient, 'getTopPosts'>;

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

const getThumbnailUrl = (post: Post): string | undefined => post.thumbnail?.url;

export const normalizeImageUrl = (post: Post): string | undefined => {
  if (
    !isSelfPost(post) &&
    post.url &&
    (post.url.endsWith('.jpg') ||
      post.url.endsWith('.png') ||
      post.url.endsWith('.gif'))
  ) {
    return post.url;
  }

  const thumbnail = getThumbnailUrl(post);
  if (
    !isSelfPost(post) &&
    thumbnail &&
    thumbnail !== 'default' &&
    thumbnail !== 'self'
  ) {
    return thumbnail;
  }

  return undefined;
};

export const buildPostSummary = (post: Post): LadderPostSummary => {
  const body = post.body;
  const summary: LadderPostSummary = {
    id: post.id,
    title: post.title,
    hasBody: body !== undefined && body.length >= 50,
    isNSFW: post.nsfw,
    isSpoiler: post.spoiler,
    commentCount: post.numberOfComments ?? 0,
  };
  const imageUrl = normalizeImageUrl(post);
  if (imageUrl !== undefined) {
    summary.imageUrl = imageUrl;
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

const emptyChain = (subredditName: string): MutableCursorChain => ({
  subreddit: subredditName,
  startsAfter: {},
  deepestKnownPage: 0,
  terminalPage: null,
  updatedAt: Date.now(),
});

const normalizeChain = (
  subredditName: string,
  chain: LadderCursorChain | null
): MutableCursorChain => chain ?? emptyChain(subredditName);

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
  subredditName: string,
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
  const previousPage = await getLadderPage(subredditName, page - 1);
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

const fetchAndPersistPage = async (
  subredditName: string,
  page: number,
  after: string | null,
  budget: NextWorkBudget,
  reddit: Reddit,
  chain: MutableCursorChain
): Promise<FetchPageResult> => {
  const listing = reddit.getTopPosts({
    subredditName,
    after: after ?? undefined,
    limit: 100,
    timeframe: 'all',
  });
  const posts = await listing.get(100);
  spendRedditCall(budget);

  const isTerminal = posts.length < 100 || !listing.hasMore;
  const nextAfter = isTerminal ? null : extractListingAfter(listing, posts);

  const cachePage: LadderCachePage = {
    page,
    startsAfter: after,
    nextAfter,
    posts: posts.map(buildPostSummary),
    fetchedAt: Date.now(),
  };

  await setLadderPage(subredditName, page, cachePage);

  chain.subreddit = subredditName;
  chain.startsAfter[page] = after;
  if (nextAfter !== null) {
    chain.startsAfter[page + 1] = nextAfter;
  }
  chain.deepestKnownPage = Math.max(chain.deepestKnownPage, page);
  if (isTerminal) {
    chain.terminalPage = page;
  }
  chain.updatedAt = Date.now();
  await setCursorChain(subredditName, chain);

  if (isTerminal) {
    return { kind: 'terminal', page: cachePage };
  }
  return { kind: 'ok', page: cachePage, nextAfter, isTerminal: false };
};

export const resolveLadderPage = async (
  subredditName: string,
  rankIndex: number,
  budget: NextWorkBudget,
  reddit: Reddit
): Promise<LadderResolveResult> => {
  if (rankIndex < 1) {
    return { kind: 'error', message: 'rankIndex must be >= 1' };
  }

  const targetPage = rankIndexToPage(rankIndex);
  const offset = rankIndexToOffset(rankIndex);

  const cachedPage = await getLadderPage(subredditName, targetPage);
  if (cachedPage !== null) {
    return { kind: 'hit', page: cachedPage, offset };
  }

  const loadedChain = await getCursorChain(subredditName);
  const chain = normalizeChain(subredditName, loadedChain);

  if (hasStartsAfter(chain, targetPage)) {
    if (!canSpendRedditCall(budget)) {
      return { kind: 'unplayable', continuationRankIndex: rankIndex };
    }

    const after = chain.startsAfter[targetPage] ?? null;
    let fetchResult: FetchPageResult;
    try {
      fetchResult = await fetchAndPersistPage(
        subredditName,
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

    const after = await resolveAfterCursor(
      subredditName,
      page,
      chain,
      lastNextAfter
    );
    let fetchResult: FetchPageResult;
    try {
      fetchResult = await fetchAndPersistPage(
        subredditName,
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
