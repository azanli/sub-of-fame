import { describe, expect, it } from 'vitest';
import { collectPostMediaUrls } from './puzzlePreload';

describe('collectPostMediaUrls', () => {
  it('collects imageUrl, galleryUrls, and content block images', () => {
    expect(
      collectPostMediaUrls({
        title: 'Test post',
        imageUrl: 'https://example.com/hero.jpg',
        galleryUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
        contentBlocks: [
          { kind: 'text', text: 'hello' },
          { kind: 'image', url: 'https://example.com/block.jpg' },
        ],
      })
    ).toEqual([
      'https://example.com/hero.jpg',
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
      'https://example.com/block.jpg',
    ]);
  });

  it('skips video imageUrl', () => {
    expect(
      collectPostMediaUrls({
        title: 'Video post',
        imageUrl: 'https://example.com/video.mp4',
        isVideo: true,
      })
    ).toEqual([]);
  });

  it('deduplicates repeated urls', () => {
    expect(
      collectPostMediaUrls({
        title: 'Duplicate post',
        imageUrl: 'https://example.com/shared.jpg',
        galleryUrls: ['https://example.com/shared.jpg'],
      })
    ).toEqual(['https://example.com/shared.jpg']);
  });
});
