// Server-only Redis storage type aliases. These types describe the shape of data
// persisted in Redis and are intentionally separate from shared API response types.
// Do not import these from src/client or src/shared.

import type { T3 } from '@devvit/shared-types/tid.js';
import type { GameMode } from '../../shared/api.js';
import type { PostContentBlock } from '../../shared/postContent.js';

export type SubredditMetadataCacheEntry = {
  subreddit: string;
  displayName: string;
  iconUrl: string;
  fetchedAt: number;
  expiresAt: number;
};

export type LadderPostSummary = {
  id: T3;
  title: string;
  postUrl: string;
  /** Subreddit the post was originally submitted to (distinct from the ladder campaign key). */
  sourceSubredditName: string;
  hasBody: boolean;
  isNSFW: boolean;
  isSpoiler: boolean;
  commentCount: number;
  imageUrl?: string;
  galleryUrls?: string[];
  /** True when `imageUrl` points at a playable video (reddit-hosted, mp4 fallback). */
  isVideo?: boolean;
};

export type LadderCachePage = {
  page: number;
  startsAfter: string | null;
  nextAfter: string | null;
  posts: LadderPostSummary[];
  fetchedAt: number;
};

// Durable, content-independent cursor index. Survives page-content expiry so
// deep pages can be re-fetched directly without re-warming from page 1.
export type LadderCursorChain = {
  subreddit: string;
  startsAfter: Record<number, string | null>;
  deepestKnownPage: number;
  terminalPage: number | null;
  updatedAt: number;
};

export type PuzzleCommentSnapshot = {
  id: string;
  body: string;
  score: number;
  createdAt: number;
};

export type PuzzleSnapshot = {
  sourcePostId: string;
  post: {
    title: string;
    body?: string;
    contentBlocks?: PostContentBlock[];
    imageUrl?: string;
    galleryUrls?: string[];
    isVideo?: boolean;
  };
  numberOfComments: number;
  // index 0 = #1 most upvotes (true rank); never scrambled
  comments: [PuzzleCommentSnapshot, PuzzleCommentSnapshot, PuzzleCommentSnapshot];
  createdAt: number;
  expiresAt: number;
};

export type PuzzleAttemptOwner = { kind: 'user'; userId: string } | { kind: 'guest' };

export type PuzzleAttempt = {
  attemptId: string;
  sourcePostId: string;
  subreddit: string;
  rankIndex: number;
  owner: PuzzleAttemptOwner;
  commentOrder: [string, string, string];
  gameMode: GameMode;
  submitted: boolean;
  createdAt: number;
  expiresAt: number;
};
