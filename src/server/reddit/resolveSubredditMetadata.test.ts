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

describe('resolveSubredditMetadata — Reddit API', () => {
  it('prefers subreddit name over community title', async () => {
    const reddit = makeReddit();
    reddit.getSubredditInfoByName.mockResolvedValue({
      id: 't5_test',
      name: 'NSFW',
      title: 'Not Safe For Work',
      type: 'public',
      isQuarantined: false,
    });
    reddit.getSubredditStyles.mockResolvedValue({ icon: 'https://example.com/icon.png' });

    const result = await resolveSubredditMetadata('nsfw', reddit);

    expect(result).toMatchObject({
      subreddit: 'nsfw',
      displayName: 'NSFW',
      metadataSource: 'reddit',
    });
    expect(mockSetMetadata).toHaveBeenCalledWith(
      'nsfw',
      expect.objectContaining({ displayName: 'NSFW' })
    );
  });

  it('strips r/ prefix from Reddit subreddit name', async () => {
    const reddit = makeReddit();
    reddit.getSubredditInfoByName.mockResolvedValue({
      id: 't5_test',
      name: 'r/DadJokes',
      title: 'Dad Jokes - the best dad jokes on the internet',
      type: 'public',
      isQuarantined: false,
    });
    reddit.getSubredditStyles.mockResolvedValue({ icon: 'https://example.com/icon.png' });

    const result = await resolveSubredditMetadata('dadjokes', reddit);

    expect(result).toMatchObject({
      subreddit: 'dadjokes',
      displayName: 'DadJokes',
    });
  });
});

describe('resolveSubredditMetadata — cache', () => {
  it('normalizes displayName when reading stale cached metadata', async () => {
    mockGetMetadata.mockResolvedValue({
      subreddit: 'nsfw',
      displayName: 'r/Not Safe For Work',
      iconUrl: 'https://example.com/icon.png',
      fetchedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    const reddit = makeReddit();

    const result = await resolveSubredditMetadata('nsfw', reddit);

    expect(result).toMatchObject({
      subreddit: 'nsfw',
      displayName: 'Not Safe For Work',
      metadataSource: 'reddit',
    });
    expect(reddit.getSubredditInfoByName).not.toHaveBeenCalled();
  });
});
