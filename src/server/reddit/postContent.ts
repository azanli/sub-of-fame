import type { Post } from '@devvit/reddit';
import {
  blocksToPlainText,
  contentBlocksIncludeImages,
  parseBodyHtml,
  parseRtjsonDocument,
  stripHtmlToText,
  type PostContentBlock,
} from '../../shared/postContent.js';
import { toLoadableRedditImageUrl } from './ladderPipeline.js';

type MediaMetadataEntry = {
  e?: string;
  s?: { u?: string };
  p?: Array<{ u?: string }>;
  m?: string;
};

const normalizePlainBody = (body: string | undefined): string | undefined => {
  if (body === undefined) {
    return undefined;
  }
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export type ResolvedPostContent = {
  contentBlocks?: PostContentBlock[];
  body?: string;
};

const isRtjsonDocument = (value: unknown): value is { document?: unknown[] } =>
  typeof value === 'object' && value !== null;

export const resolvePostContentFromRtjson = (
  rtjson: unknown,
  mediaMetadata?: Record<string, MediaMetadataEntry>
): ResolvedPostContent | undefined => {
  let parsed: { document?: unknown[] } | undefined;
  if (typeof rtjson === 'string') {
    try {
      const decoded: unknown = JSON.parse(rtjson);
      parsed = isRtjsonDocument(decoded) ? decoded : undefined;
    } catch {
      parsed = undefined;
    }
  } else if (isRtjsonDocument(rtjson)) {
    parsed = rtjson;
  }

  if (parsed === undefined || !Array.isArray(parsed.document)) {
    return undefined;
  }

  const contentBlocks = parseRtjsonDocument(parsed, mediaMetadata, toLoadableRedditImageUrl);
  if (contentBlocks.length === 0) {
    return undefined;
  }

  return {
    contentBlocks,
    body: blocksToPlainText(contentBlocks),
  };
};

export const resolvePostContent = (post: Post): ResolvedPostContent => {
  const bodyHtml = post.bodyHtml?.trim();
  if (bodyHtml !== undefined && bodyHtml.length > 0) {
    const htmlBlocks = parseBodyHtml(bodyHtml, toLoadableRedditImageUrl);
    if (htmlBlocks.length > 0) {
      return {
        contentBlocks: htmlBlocks,
        body: blocksToPlainText(htmlBlocks) || normalizePlainBody(post.body),
      };
    }

    const htmlText = stripHtmlToText(bodyHtml);
    if (htmlText.length > 0) {
      return { body: htmlText };
    }
  }

  return { body: normalizePlainBody(post.body) };
};

export const resolvePostPlainText = (post: Post): string => {
  const resolved = resolvePostContent(post);
  if (resolved.body !== undefined) {
    return resolved.body;
  }
  if (resolved.contentBlocks !== undefined) {
    return blocksToPlainText(resolved.contentBlocks);
  }
  return post.body?.trim() ?? '';
};

export const shouldRenderTrailingGallery = (
  contentBlocks: PostContentBlock[] | undefined,
  galleryUrls: string[] | undefined
): galleryUrls is string[] =>
  galleryUrls !== undefined &&
  galleryUrls.length > 1 &&
  (contentBlocks === undefined || !contentBlocksIncludeImages(contentBlocks));

export const shouldRenderTrailingSingleImage = (
  contentBlocks: PostContentBlock[] | undefined,
  galleryUrls: string[] | undefined,
  imageUrl: string | undefined
): imageUrl is string => {
  if (imageUrl === undefined || imageUrl.length === 0) {
    return false;
  }

  if (contentBlocks !== undefined && contentBlocksIncludeImages(contentBlocks)) {
    return false;
  }

  if (galleryUrls !== undefined && galleryUrls.length > 1) {
    return false;
  }

  return true;
};
