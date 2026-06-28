import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Post } from '@devvit/reddit/models/Post.js';
import type { LadderCachePage, LadderCursorChain } from '../redis/types.js';
import type { NextWorkBudget } from '../../shared/api.js';

const {
  mockGetLadderPage,
  mockSetLadderPage,
  mockGetCursorChain,
  mockSetCursorChain,
  mockGetTopPosts,
} = vi.hoisted(() => ({
  mockGetLadderPage: vi.fn(),
  mockSetLadderPage: vi.fn(),
  mockGetCursorChain: vi.fn(),
  mockSetCursorChain: vi.fn(),
  mockGetTopPosts: vi.fn(),
}));

vi.mock('../redis/ladderStore.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../redis/ladderStore.js')>();
  return {
    ...original,
    getLadderPage: mockGetLadderPage,
    setLadderPage: mockSetLadderPage,
    getCursorChain: mockGetCursorChain,
    setCursorChain: mockSetCursorChain,
  };
});

const {
  canSpendRedditCall,
  fastFilterEligible,
  normalizeImageUrl,
  resolveLadderPage,
} = await import('./ladderPipeline.js');

const { rankIndexToOffset, rankIndexToPage } = await import('../redis/ladderStore.js');

const basePostData = {
  id: 'abc123',
  title: 'A long enough title',
  createdUtc: 1_700_000_000,
  author: 'testuser',
  subreddit: 'gaming',
  subredditId: 't5_gaming',
  permalink: '/r/gaming/comments/abc123/title/',
  selftext: '',
  numComments: 42,
  over18: false,
  spoiler: false,
};

const makePost = (
  overrides: Partial<{
    id: string;
    title: string;
    url: string;
    selftext: string;
    thumbnail: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
    numComments: number;
    over18: boolean;
    spoiler: boolean;
  }> = {}
): Post =>
  new Post({
    ...basePostData,
    url: 'https://example.com/image.jpg',
    ...overrides,
  });

const makeBudget = (overrides: Partial<NextWorkBudget> = {}): NextWorkBudget => ({
  redditCallsRemaining: 12,
  softDeadlineAt: Date.now() + 60_000,
  itemsCheckedRemaining: 20,
  ...overrides,
});

const makeListing = (posts: Post[], nextAfter: string | null = 'cursor_next') => ({
  get: vi.fn().mockResolvedValue(posts),
  hasMore: nextAfter !== null,
  after: nextAfter,
});

beforeEach(() => {
  mockGetLadderPage.mockReset();
  mockSetLadderPage.mockReset();
  mockGetCursorChain.mockReset();
  mockSetCursorChain.mockReset();
  mockGetTopPosts.mockReset();
  mockSetLadderPage.mockResolvedValue(undefined);
  mockSetCursorChain.mockResolvedValue(undefined);
});

describe('rank math – page', () => {
  it('returns 1 for rank 1, 1 for rank 100, 2 for rank 101, 2 for rank 200', () => {
    expect(rankIndexToPage(1)).toBe(1);
    expect(rankIndexToPage(100)).toBe(1);
    expect(rankIndexToPage(101)).toBe(2);
    expect(rankIndexToPage(200)).toBe(2);
  });
});

describe('rank math – offset', () => {
  it('returns 0 for rank 1, 99 for rank 100, 0 for rank 101', () => {
    expect(rankIndexToOffset(1)).toBe(0);
    expect(rankIndexToOffset(100)).toBe(99);
    expect(rankIndexToOffset(101)).toBe(0);
  });
});

describe('normalizeImageUrl – direct jpg', () => {
  it('returns the jpg URL for a non-self post', () => {
    const post = makePost({ url: 'https://example.com/photo.jpg' });
    expect(normalizeImageUrl(post)).toBe('https://example.com/photo.jpg');
  });
});

describe('normalizeImageUrl – direct png', () => {
  it('returns the png URL for a non-self post', () => {
    const post = makePost({ url: 'https://example.com/photo.png' });
    expect(normalizeImageUrl(post)).toBe('https://example.com/photo.png');
  });
});

describe('normalizeImageUrl – thumbnail fallback', () => {
  it('returns the thumbnail when no direct image URL exists', () => {
    const post = makePost({
      url: 'https://example.com/video',
      thumbnail: 'https://example.com/thumb.jpg',
      thumbnailHeight: 140,
      thumbnailWidth: 140,
    });
    expect(normalizeImageUrl(post)).toBe('https://example.com/thumb.jpg');
  });
});

describe('normalizeImageUrl – self post', () => {
  it('returns undefined for a self post', () => {
    const post = makePost({
      url: 'https://www.reddit.com/r/gaming/comments/abc123/title/',
    });
    expect(normalizeImageUrl(post)).toBeUndefined();
  });
});

describe('normalizeImageUrl – default thumbnail', () => {
  it('returns undefined when thumbnail is default', () => {
    const post = makePost({
      url: 'https://example.com/video',
      thumbnail: 'default',
      thumbnailHeight: 140,
      thumbnailWidth: 140,
    });
    expect(normalizeImageUrl(post)).toBeUndefined();
  });
});

describe('fastFilterEligible – NSFW', () => {
  it('returns false for NSFW posts', () => {
    expect(
      fastFilterEligible({
        id: 't3_1',
        title: 'Long enough title',
        hasBody: false,
        isNSFW: true,
        isSpoiler: false,
        commentCount: 20,
      })
    ).toBe(false);
  });
});

describe('fastFilterEligible – spoiler', () => {
  it('returns false for spoiler posts', () => {
    expect(
      fastFilterEligible({
        id: 't3_1',
        title: 'Long enough title',
        hasBody: false,
        isNSFW: false,
        isSpoiler: true,
        commentCount: 20,
      })
    ).toBe(false);
  });
});

describe('fastFilterEligible – short title no body', () => {
  it('returns false when title is short and hasBody is false', () => {
    expect(
      fastFilterEligible({
        id: 't3_1',
        title: 'short',
        hasBody: false,
        isNSFW: false,
        isSpoiler: false,
        commentCount: 20,
      })
    ).toBe(false);
  });
});

describe('fastFilterEligible – low comment count', () => {
  it('returns false when commentCount is 9', () => {
    expect(
      fastFilterEligible({
        id: 't3_1',
        title: 'Long enough title',
        hasBody: false,
        isNSFW: false,
        isSpoiler: false,
        commentCount: 9,
      })
    ).toBe(false);
  });
});

describe('fastFilterEligible – valid post', () => {
  it('returns true when all filters pass', () => {
    expect(
      fastFilterEligible({
        id: 't3_1',
        title: 'Long enough title',
        hasBody: false,
        isNSFW: false,
        isSpoiler: false,
        commentCount: 20,
      })
    ).toBe(true);
  });
});

describe('canSpendRedditCall – zero calls', () => {
  it('returns false when redditCallsRemaining is 0', () => {
    expect(canSpendRedditCall(makeBudget({ redditCallsRemaining: 0 }))).toBe(false);
  });
});

describe('canSpendRedditCall – past deadline', () => {
  it('returns false when softDeadlineAt is in the past', () => {
    expect(canSpendRedditCall(makeBudget({ softDeadlineAt: Date.now() - 1 }))).toBe(false);
  });
});

describe('canSpendRedditCall – budget available', () => {
  it('returns true when calls remain and deadline is in the future', () => {
    expect(canSpendRedditCall(makeBudget())).toBe(true);
  });
});

describe('resolveLadderPage – cache hit', () => {
  it('returns hit without calling reddit when the page is cached', async () => {
    const cachedPage: LadderCachePage = {
      page: 1,
      startsAfter: null,
      nextAfter: 'cursor_abc',
      posts: [],
      fetchedAt: 1000,
    };
    mockGetLadderPage.mockResolvedValue(cachedPage);

    const reddit = { getTopPosts: mockGetTopPosts };
    const result = await resolveLadderPage('gaming', 5, makeBudget(), reddit);

    expect(result).toEqual({ kind: 'hit', page: cachedPage, offset: 4 });
    expect(mockGetTopPosts).not.toHaveBeenCalled();
  });
});

describe('resolveLadderPage – direct cursor fetch', () => {
  it('fetches one page when startsAfter for the target page is known', async () => {
    mockGetLadderPage.mockResolvedValue(null);
    const chain: LadderCursorChain = {
      subreddit: 'gaming',
      startsAfter: { 1: null, 2: 'cursor_page1' },
      deepestKnownPage: 2,
      terminalPage: null,
      updatedAt: 1000,
    };
    mockGetCursorChain.mockResolvedValue(chain);

    const posts = [makePost({ id: 'post201', title: 'Rank 201 post title' })];
    mockGetTopPosts.mockReturnValue(makeListing(posts, 'cursor_page2'));

    const reddit = { getTopPosts: mockGetTopPosts };
    const budget = makeBudget();
    const result = await resolveLadderPage('gaming', 150, budget, reddit);

    expect(mockGetTopPosts).toHaveBeenCalledTimes(1);
    expect(mockGetTopPosts).toHaveBeenCalledWith({
      subredditName: 'gaming',
      after: 'cursor_page1',
      limit: 100,
    });
    expect(mockSetLadderPage).toHaveBeenCalledTimes(1);
    expect(mockSetCursorChain).toHaveBeenCalledTimes(1);
    expect(budget.redditCallsRemaining).toBe(11);
    expect(result.kind).toBe('hit');
    if (result.kind === 'hit') {
      expect(result.offset).toBe(49);
      expect(result.page.page).toBe(2);
    }
  });
});

describe('resolveLadderPage – warm forward', () => {
  it('fetches intermediate pages when the target cursor is unknown', async () => {
    mockGetLadderPage.mockResolvedValue(null);
    const chain: LadderCursorChain = {
      subreddit: 'gaming',
      startsAfter: { 1: null, 2: 'cursor_page1' },
      deepestKnownPage: 1,
      terminalPage: null,
      updatedAt: 1000,
    };
    mockGetCursorChain.mockResolvedValue(chain);

    const page2Posts = Array.from({ length: 100 }, (_, index) =>
      makePost({ id: `page2_${index}`, title: `Page two post ${index}` })
    );
    const page3Posts = [makePost({ id: 'page3_0', title: 'Page three post zero' })];

    mockGetTopPosts
      .mockReturnValueOnce(makeListing(page2Posts, 'cursor_page2'))
      .mockReturnValueOnce(makeListing(page3Posts, 'cursor_page3'));

    const reddit = { getTopPosts: mockGetTopPosts };
    const budget = makeBudget({ redditCallsRemaining: 2 });
    const result = await resolveLadderPage('gaming', 201, budget, reddit);

    expect(mockGetTopPosts).toHaveBeenCalledTimes(2);
    expect(mockSetLadderPage).toHaveBeenCalledTimes(2);
    expect(mockSetCursorChain).toHaveBeenCalledTimes(2);
    expect(budget.redditCallsRemaining).toBe(0);
    expect(result.kind).toBe('hit');
    if (result.kind === 'hit') {
      expect(result.page.page).toBe(3);
      expect(result.offset).toBe(0);
    }
  });
});

describe('resolveLadderPage – terminal before target', () => {
  it('returns exhausted when the listing ends before the target page', async () => {
    mockGetLadderPage.mockResolvedValue(null);
    const chain: LadderCursorChain = {
      subreddit: 'gaming',
      startsAfter: { 1: null, 2: 'cursor_page1' },
      deepestKnownPage: 1,
      terminalPage: null,
      updatedAt: 1000,
    };
    mockGetCursorChain.mockResolvedValue(chain);

    const terminalPosts = [makePost({ id: 'only_post', title: 'Only post on page two' })];
    mockGetTopPosts.mockReturnValue(makeListing(terminalPosts, null));

    const reddit = { getTopPosts: mockGetTopPosts };
    const result = await resolveLadderPage('gaming', 201, makeBudget(), reddit);

    expect(result).toEqual({ kind: 'exhausted' });
  });
});

describe('resolveLadderPage – budget exhaustion', () => {
  it('returns unplayable when redditCallsRemaining is 0 before fetching', async () => {
    mockGetLadderPage.mockResolvedValue(null);
    mockGetCursorChain.mockResolvedValue(null);

    const reddit = { getTopPosts: mockGetTopPosts };
    const result = await resolveLadderPage(
      'gaming',
      1,
      makeBudget({ redditCallsRemaining: 0 }),
      reddit
    );

    expect(result).toEqual({ kind: 'unplayable', continuationRankIndex: 1 });
    expect(mockGetTopPosts).not.toHaveBeenCalled();
  });
});

describe('resolveLadderPage – malformed cache', () => {
  it('falls through to cursor resolution when getLadderPage returns null', async () => {
    mockGetLadderPage.mockResolvedValue(null);
    mockGetCursorChain.mockResolvedValue(null);

    const posts = Array.from({ length: 100 }, (_, index) =>
      makePost({ id: `cold_${index}`, title: `Cold start post ${index}` })
    );
    mockGetTopPosts.mockReturnValue(makeListing(posts, 'cursor_after_page1'));

    const reddit = { getTopPosts: mockGetTopPosts };
    const result = await resolveLadderPage('gaming', 1, makeBudget(), reddit);

    expect(mockGetTopPosts).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('hit');
  });
});

describe('resolveLadderPage – cold start page 1', () => {
  it('fetches page 1 with after null when no cursor chain exists', async () => {
    mockGetLadderPage.mockResolvedValue(null);
    mockGetCursorChain.mockResolvedValue(null);

    const posts = Array.from({ length: 100 }, (_, index) =>
      makePost({ id: `cold_${index}`, title: `Cold start post ${index}` })
    );
    mockGetTopPosts.mockReturnValue(makeListing(posts, 'cursor_after_page1'));

    const reddit = { getTopPosts: mockGetTopPosts };
    const result = await resolveLadderPage('gaming', 1, makeBudget(), reddit);

    expect(mockGetTopPosts).toHaveBeenCalledWith({
      subredditName: 'gaming',
      after: undefined,
      limit: 100,
    });
    expect(result.kind).toBe('hit');
    if (result.kind === 'hit') {
      expect(result.page.page).toBe(1);
      expect(result.offset).toBe(0);
    }
  });
});

describe('resolveLadderPage – reddit fetch failure', () => {
  it('returns error when the reddit listing fetch throws', async () => {
    mockGetLadderPage.mockResolvedValue(null);
    mockGetCursorChain.mockResolvedValue(null);
    mockGetTopPosts.mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('403 Forbidden: private')),
      hasMore: false,
      after: null,
    });

    const reddit = { getTopPosts: mockGetTopPosts };
    const result = await resolveLadderPage('gaming', 1, makeBudget(), reddit);

    expect(result).toEqual({ kind: 'error', message: '403 Forbidden: private' });
  });
});

describe('resolveLadderPage – invalid rankIndex', () => {
  it('returns error when rankIndex is 0', async () => {
    const reddit = { getTopPosts: mockGetTopPosts };
    const result = await resolveLadderPage('gaming', 0, makeBudget(), reddit);

    expect(result.kind).toBe('error');
    expect(mockGetTopPosts).not.toHaveBeenCalled();
  });
});
