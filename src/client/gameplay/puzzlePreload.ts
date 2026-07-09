import type { ReadyPuzzle } from './types';

type PuzzlePost = ReadyPuzzle['post'];

export const collectPostMediaUrls = (post: PuzzlePost): string[] => {
  const urls = new Set<string>();

  if (post.imageUrl !== undefined && !post.isVideo) {
    urls.add(post.imageUrl);
  }

  if (post.galleryUrls !== undefined) {
    for (const url of post.galleryUrls) {
      urls.add(url);
    }
  }

  if (post.contentBlocks !== undefined) {
    for (const block of post.contentBlocks) {
      if (block.kind === 'image') {
        urls.add(block.url);
      }
    }
  }

  return [...urls];
};

export const preloadPuzzlePostMedia = (post: PuzzlePost): void => {
  for (const url of collectPostMediaUrls(post)) {
    const img = new Image();
    img.src = url;
  }
};
