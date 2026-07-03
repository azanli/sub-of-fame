import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGetMetadata = vi.fn();
const mockSetMetadata = vi.fn();

vi.mock('../redis/metadataStore', () => ({
  getMetadata: mockGetMetadata,
  setMetadata: mockSetMetadata,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const { resolveSubredditMetadata } = await import('./resolveSubredditMetadata');

const makeReddit = () => ({
  getSubredditInfoByName: vi.fn(),
  getSubredditStyles: vi.fn(),
});

describe('resolveSubredditMetadata — Daily Challenge (r/all)', () => {
  it('resolves the all subreddit locally without calling the Reddit API', async () => {
    const reddit = makeReddit();

    const result = await resolveSubredditMetadata('all', reddit);

    expect(result).toEqual({
      subreddit: 'all',
      displayName: 'all',
      iconUrl: '/fame-icon.png',
      metadataSource: 'curated',
    });
    expect(reddit.getSubredditInfoByName).not.toHaveBeenCalled();
    expect(mockGetMetadata).not.toHaveBeenCalled();
    expect(mockSetMetadata).not.toHaveBeenCalled();
  });
});
