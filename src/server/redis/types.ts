// Server-only Redis storage type aliases. These types describe the shape of data
// persisted in Redis and are intentionally separate from shared API response types.
// Do not import these from src/client or src/shared.

export type SubredditMetadataCacheEntry = {
  subreddit: string;
  displayName: string;
  iconUrl: string;
  fetchedAt: number;
  expiresAt: number;
};

export type LadderPostSummary = {
  id: string;
  title: string;
  hasBody: boolean;
  isNSFW: boolean;
  isSpoiler: boolean;
  commentCount: number;
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
  post: { title: string; body?: string; imageUrl?: string };
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
  submitted: boolean;
  createdAt: number;
  expiresAt: number;
};
