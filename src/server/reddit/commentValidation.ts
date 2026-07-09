import type { Comment, Listing, RedditClient } from '@devvit/reddit';
import { T3 } from '@devvit/shared-types/tid.js';
import type { NextWorkBudget } from '../../shared/api.js';
import type { PostContentBlock } from '../../shared/postContent.js';
import { MIN_TOP_COMMENT_SCORE } from '../config.js';
import { SNAPSHOT_TTL_S } from '../redis/keys.js';
import { getSnapshot, setSnapshot } from '../redis/snapshotStore.js';
import type { PuzzleCommentSnapshot, PuzzleSnapshot } from '../redis/types.js';
import { canSpendRedditCall, spendRedditCall } from './ladderPipeline.js';
import {
  computeAdaptiveMaxCommentLength,
  computeThreadDensityBaseline,
} from './threadDensity.js';

export type CommentValidationResult =
  | { kind: 'valid'; snapshot: PuzzleSnapshot }
  | { kind: 'invalid' }
  | { kind: 'unplayable' }
  | { kind: 'error'; cause: unknown };

export type ValidateCommentsParams = {
  sourcePostId: string;
  post: {
    title: string;
    body?: string;
    contentBlocks?: PostContentBlock[];
    imageUrl?: string;
    galleryUrls?: string[];
    isVideo?: boolean;
    linkUrl?: string;
    linkDomain?: string;
  };
  numberOfComments: number;
};

type Reddit = Pick<RedditClient, 'getComments'>;

const EVALUATION_POOL_SIZE = 8;
const COMMENT_FETCH_LIMIT = 25;
const MIN_BODY_CHARS = 16;
const SNAPSHOT_VALIDATION_VERSION = 3;
const URL_PATTERN =
  /(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9-]+\.)*redd\.it\/\S+|\b(?:redd|youtu)\.be\/\S+|\breddit(?:media)?\.com\/\S+/i;

export const normalizeBody = (body: string): string =>
  body.trim().replace(/\s+/g, ' ');

export const containsUrl = (body: string): boolean => URL_PATTERN.test(body);

const snapshotHasUrlComments = (snapshot: PuzzleSnapshot): boolean =>
  snapshot.comments.some((comment) => containsUrl(comment.body));

export const isTopLevel = (comment: Comment, sourcePostId: string): boolean =>
  comment.parentId === sourcePostId;

export const isBodyValid = (
  normalizedBody: string,
  maxLength: number
): boolean => {
  if (normalizedBody.length < MIN_BODY_CHARS) {
    return false;
  }
  if (normalizedBody.length > maxLength) {
    return false;
  }
  const sentinel = normalizedBody.toLowerCase();
  return sentinel !== '[deleted]' && sentinel !== '[removed]';
};

export const isAuthorValid = (authorName: string): boolean =>
  authorName.toLowerCase() !== 'automoderator';

export const isNotModerationContent = (comment: Comment): boolean =>
  !comment.stickied &&
  (comment.distinguishedBy === undefined || comment.distinguishedBy === '');

export const isScoreValid = (score: unknown): boolean =>
  typeof score === 'number' && Number.isFinite(score);

export const deduplicateById = (comments: Comment[]): Comment[] => {
  const seen = new Set<string>();
  const unique: Comment[] = [];
  for (const comment of comments) {
    if (seen.has(comment.id)) {
      continue;
    }
    seen.add(comment.id);
    unique.push(comment);
  }
  return unique;
};

export const hasDistinctScores = (
  candidates: PuzzleCommentSnapshot[]
): boolean => {
  if (candidates.length < 3) {
    return false;
  }
  const scores = candidates.slice(0, 3).map((candidate) => candidate.score);
  return new Set(scores).size === 3;
};

export const selectTopLevelRoots = (
  comments: Comment[],
  sourcePostId: string
): Comment[] =>
  deduplicateById(comments)
    .filter((comment) => isTopLevel(comment, sourcePostId))
    .sort((left, right) => right.score - left.score);

export const takeEvaluationPool = (
  roots: Comment[],
  poolSize = EVALUATION_POOL_SIZE
): Comment[] => roots.slice(0, poolSize);

export const filterValidRoots = (
  pool: Comment[],
  sourcePostId: string,
  maxLength: number
): Comment[] =>
  pool.filter((comment) => isValidRoot(comment, sourcePostId, maxLength));

export const passesRawTopScoreFloor = (rawTopRoot: Comment): boolean =>
  isScoreValid(rawTopRoot.score) && rawTopRoot.score >= MIN_TOP_COMMENT_SCORE;

export const passesPlayabilityGates = (
  selected: PuzzleCommentSnapshot[]
): boolean => selected.length === 3 && hasDistinctScores(selected);

const isValidRoot = (
  comment: Comment,
  sourcePostId: string,
  maxLength: number
): boolean => {
  if (comment.removed) {
    return false;
  }
  if (!isTopLevel(comment, sourcePostId)) {
    return false;
  }
  if (!isAuthorValid(comment.authorName)) {
    return false;
  }
  if (!isNotModerationContent(comment)) {
    return false;
  }
  if (!isScoreValid(comment.score)) {
    return false;
  }
  const normalizedBody = normalizeBody(comment.body);
  if (containsUrl(normalizedBody)) {
    return false;
  }
  return isBodyValid(normalizedBody, maxLength);
};

const toCommentSnapshot = (comment: Comment): PuzzleCommentSnapshot => ({
  id: comment.id,
  body: normalizeBody(comment.body),
  score: comment.score,
  createdAt: comment.createdAt.getTime(),
});

const isCachedSnapshotUsable = (cached: PuzzleSnapshot): boolean => {
  if (cached.validationVersion !== SNAPSHOT_VALIDATION_VERSION) {
    return false;
  }
  if (cached.rawTopScore === undefined) {
    return false;
  }
  if (cached.rawTopScore < MIN_TOP_COMMENT_SCORE) {
    return false;
  }
  if (snapshotHasUrlComments(cached)) {
    return false;
  }
  return passesPlayabilityGates(cached.comments);
};

const mergePostMetadata = (
  cached: PuzzleSnapshot,
  post: ValidateCommentsParams['post'],
  numberOfComments: number
): PuzzleSnapshot => ({
  ...cached,
  post: {
    ...cached.post,
    ...(post.body !== undefined ? { body: post.body } : {}),
    ...(post.contentBlocks !== undefined
      ? { contentBlocks: post.contentBlocks }
      : {}),
    ...(post.imageUrl !== undefined ? { imageUrl: post.imageUrl } : {}),
    ...(post.galleryUrls !== undefined ? { galleryUrls: post.galleryUrls } : {}),
    ...(post.isVideo !== undefined ? { isVideo: post.isVideo } : {}),
    ...(post.linkUrl !== undefined ? { linkUrl: post.linkUrl } : {}),
    ...(post.linkDomain !== undefined ? { linkDomain: post.linkDomain } : {}),
  },
  numberOfComments: cached.numberOfComments ?? numberOfComments,
});

const buildPostPayload = (
  post: ValidateCommentsParams['post']
): PuzzleSnapshot['post'] => ({
  title: post.title,
  ...(post.body !== undefined ? { body: post.body } : {}),
  ...(post.contentBlocks !== undefined ? { contentBlocks: post.contentBlocks } : {}),
  ...(post.imageUrl !== undefined ? { imageUrl: post.imageUrl } : {}),
  ...(post.galleryUrls !== undefined ? { galleryUrls: post.galleryUrls } : {}),
  ...(post.isVideo !== undefined ? { isVideo: post.isVideo } : {}),
  ...(post.linkUrl !== undefined ? { linkUrl: post.linkUrl } : {}),
  ...(post.linkDomain !== undefined ? { linkDomain: post.linkDomain } : {}),
});

export const validateComments = async (
  params: ValidateCommentsParams,
  reddit: Reddit,
  budget: NextWorkBudget
): Promise<CommentValidationResult> => {
  const { sourcePostId, post, numberOfComments } = params;

  try {
    const cached = await getSnapshot(sourcePostId);
    if (cached !== null && isCachedSnapshotUsable(cached)) {
      return {
        kind: 'valid',
        snapshot: mergePostMetadata(cached, post, numberOfComments),
      };
    }

    if (!canSpendRedditCall(budget)) {
      return { kind: 'unplayable' };
    }

    const listing: Listing<Comment> = reddit.getComments({
      postId: T3(sourcePostId),
      sort: 'top',
      depth: 1,
      limit: COMMENT_FETCH_LIMIT,
      pageSize: COMMENT_FETCH_LIMIT,
    });
    const comments = await listing.get(COMMENT_FETCH_LIMIT);
    spendRedditCall(budget);

    const allTopLevel = selectTopLevelRoots(comments, sourcePostId);

    if (allTopLevel.length === 0) {
      return { kind: 'invalid' };
    }

    const rawTop = allTopLevel[0]!;
    if (!passesRawTopScoreFloor(rawTop)) {
      return { kind: 'invalid' };
    }

    const pool = takeEvaluationPool(allTopLevel);
    const threadDensityBaseline = computeThreadDensityBaseline(pool, normalizeBody);
    const maxCommentLength = computeAdaptiveMaxCommentLength(threadDensityBaseline);
    const survivors = filterValidRoots(pool, sourcePostId, maxCommentLength).map(
      toCommentSnapshot
    );

    if (survivors.length < 3) {
      return { kind: 'invalid' };
    }

    const selected = survivors.slice(0, 3);
    if (!passesPlayabilityGates(selected)) {
      return { kind: 'invalid' };
    }

    const now = Date.now();
    const snapshot: PuzzleSnapshot = {
      sourcePostId,
      post: buildPostPayload(post),
      numberOfComments,
      comments: [selected[0]!, selected[1]!, selected[2]!],
      createdAt: now,
      expiresAt: now + SNAPSHOT_TTL_S * 1000,
      rawTopScore: rawTop.score,
      threadDensityBaseline,
      maxCommentLength,
      validationVersion: SNAPSHOT_VALIDATION_VERSION,
    };

    await setSnapshot(sourcePostId, snapshot);
    return { kind: 'valid', snapshot };
  } catch (cause) {
    return { kind: 'error', cause };
  }
};
