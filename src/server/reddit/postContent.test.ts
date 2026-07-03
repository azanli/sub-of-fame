import { describe, expect, it } from 'vitest';
import { GalleryMediaStatus, Post } from '@devvit/reddit/models/Post.js';
import {
  resolvePostContent,
  resolvePostContentFromRtjson,
  resolvePostPlainText,
  shouldRenderTrailingGallery,
  shouldRenderTrailingSingleImage,
} from './postContent.js';

const basePostData = {
  id: 'abc123',
  title: 'Test post',
  createdUtc: 1_700_000_000,
  author: 'testuser',
  subreddit: 'gaming',
  subredditId: 't5_gaming',
  permalink: '/r/gaming/comments/abc123/title/',
  selftext: 'Truncated body',
  numComments: 42,
  over18: false,
  spoiler: false,
  url: 'https://www.reddit.com/r/gaming/comments/abc123/title/',
};

const makePost = (
  overrides: Partial<{
    selftext: string;
    selftextHtml: string;
    url: string;
    gallery: Array<{
      url: string;
      width: number;
      height: number;
      status: number;
    }>;
  }> = {}
): Post =>
  new Post({
    ...basePostData,
    ...overrides,
  });

describe('resolvePostContentFromRtjson', () => {
  it('builds interleaved blocks from rtjson and media metadata', () => {
    const resolved = resolvePostContentFromRtjson(
      {
        document: [
          { e: 'par', c: [{ e: 'text', t: 'Before' }] },
          { e: 'img', c: 'img1' },
          { e: 'par', c: [{ e: 'text', t: 'After' }] },
        ],
      },
      {
        img1: { s: { u: 'https://preview.redd.it/img1.png' } },
      }
    );

    expect(resolved?.contentBlocks).toEqual([
      { kind: 'text', text: 'Before' },
      { kind: 'image', url: 'https://i.redd.it/img1.png' },
      { kind: 'text', text: 'After' },
    ]);
  });
});

describe('resolvePostContent', () => {
  it('prefers bodyHtml over truncated selftext for mixed rich posts', () => {
    const post = makePost({
      selftext: 'Only the intro survives in markdown fallback.',
      selftextHtml:
        '<div class="md"><p>Only the intro survives in markdown fallback.</p><p><img src="https://preview.redd.it/photo.png?width=640" /></p><p>This paragraph was missing from post.body.</p></div>',
    });

    const resolved = resolvePostContent(post);

    expect(resolved.contentBlocks).toEqual([
      { kind: 'text', text: 'Only the intro survives in markdown fallback.' },
      { kind: 'image', url: 'https://i.redd.it/photo.png' },
      { kind: 'text', text: 'This paragraph was missing from post.body.' },
    ]);
    expect(resolved.body).toBe(
      'Only the intro survives in markdown fallback.\n\nThis paragraph was missing from post.body.'
    );
  });

  it('falls back to plain selftext when no rich content is present', () => {
    const post = makePost({
      selftext: 'Plain markdown post body with enough text for puzzles.',
    });

    expect(resolvePostContent(post)).toEqual({
      body: 'Plain markdown post body with enough text for puzzles.',
    });
  });
});

describe('resolvePostPlainText', () => {
  it('uses rich content text for eligibility checks', () => {
    const post = makePost({
      selftext: 'Short',
      selftextHtml:
        '<div class="md"><p>Short</p><p><img src="https://preview.redd.it/photo.png" /></p><p>This hidden paragraph makes the post long enough for gameplay eligibility checks.</p></div>',
    });

    expect(resolvePostPlainText(post).length).toBeGreaterThanOrEqual(50);
  });
});

describe('trailing media helpers', () => {
  it('keeps gallery rendering for caption-only rich posts', () => {
    const blocks = [{ kind: 'text' as const, text: 'Gallery caption' }];
    const galleryUrls = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];

    expect(shouldRenderTrailingGallery(blocks, galleryUrls)).toBe(true);
    expect(shouldRenderTrailingSingleImage(blocks, galleryUrls, galleryUrls[0])).toBe(false);
  });

  it('suppresses trailing media when inline images are already rendered', () => {
    const blocks = [
      { kind: 'text' as const, text: 'Before' },
      { kind: 'image' as const, url: 'https://example.com/inline.jpg' },
    ];

    expect(shouldRenderTrailingGallery(blocks, ['https://example.com/1.jpg', 'https://example.com/2.jpg'])).toBe(
      false
    );
    expect(shouldRenderTrailingSingleImage(blocks, undefined, 'https://example.com/inline.jpg')).toBe(
      false
    );
  });
});

describe('gallery post fixture', () => {
  it('does not break gallery normalization', () => {
    const post = makePost({
      url: 'https://www.reddit.com/gallery/abc123',
      gallery: [
        {
          url: 'https://preview.redd.it/first.png',
          width: 1000,
          height: 800,
          status: GalleryMediaStatus.VALID,
        },
        {
          url: 'https://preview.redd.it/second.png',
          width: 1000,
          height: 800,
          status: GalleryMediaStatus.VALID,
        },
      ],
    });

    expect(resolvePostContent(post).body).toBe('Truncated body');
  });
});
