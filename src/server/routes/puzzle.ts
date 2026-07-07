import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { isDevPlaytestHost } from '../config';
import { resolveCampaignContext } from '../campaignContext';
import {
  deriveLaunchContext,
  normalizeSubredditName,
} from '../launchContext';
import { resolveSubredditMetadata } from '../reddit/resolveSubredditMetadata';
import {
  fastFilterEligible,
  getVideoFallbackUrl,
  resolveLadderPage,
  resolveLadderPostUrl,
  resolvePostGalleryUrls,
  resolvePostImageUrl,
} from '../reddit/ladderPipeline';
import { resolvePostContent } from '../reddit/postContent';
import { validateComments } from '../reddit/commentValidation';
import { resolveCampaignLadderPageSize } from '../redis/campaignKeys';
import {
  advanceRankIndex,
  getRankIndex,
  setRankIndex,
} from '../redis/rankProgress';
import {
  getAttempt,
  markAttemptSubmitted,
  setAttempt,
} from '../redis/attemptStore';
import { getSnapshot } from '../redis/snapshotStore';
import { acquireSubmitLock } from '../redis/submitLockStore';
import {
  computeHiveIQ,
  deductCoin,
  getGameMode,
  getStats,
  getSubredditAggregate,
  incrementStats,
} from '../redis/statsStore';
import { updateLeaderboard } from '../redis/leaderboardStore';
import { upsertUsername } from '../redis/profileStore';
import { ATTEMPT_TTL_S } from '../redis/keys';
import type { PuzzleAttempt, PuzzleAttemptOwner, PuzzleSnapshot } from '../redis/types';
import type { CampaignContext } from '../../shared/campaignContext';
import { CAMPAIGN_TIMEFRAME_IDS } from '../../shared/campaignContext';
import {
  CASUAL_COIN_AWARDS,
  DEFAULT_GAME_MODE,
  MAX_ITEMS_CHECKED,
  MAX_REDDIT_CALLS,
  SOFT_DEADLINE_MS,
  type NextWorkBudget,
  type PuzzleNextResponse,
  type PuzzleRevealSlot,
  type PuzzleForfeitError,
  type PuzzleForfeitResponse,
  type PuzzleSkipError,
  type PuzzleSkipResponse,
  type PuzzleSubmitError,
  type PuzzleSubmitErrorCode,
  type PuzzleSubmitResponse,
  type RoundStatsDelta,
  type UserActiveSubredditMetrics,
} from '../../shared/api';
import { isDailyChallengeSubreddit } from '../../shared/dailyChallenge';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';

const UNPLAYABLE_MESSAGE =
  'Could not find a playable puzzle within the current request budget. Retry to continue.';
const EXHAUSTED_MESSAGE =
  'No more playable posts remain on this subreddit ladder.';

const resolveSubredditDisplayName = async (
  subredditName: string,
  reddit: Parameters<typeof resolveSubredditMetadata>[1]
): Promise<string> => {
  const metadata = await resolveSubredditMetadata(subredditName, reddit);
  return (
    metadata?.displayName ??
    CURATED_SUBREDDITS.find((entry) => entry.name === subredditName)
      ?.subreddit ??
    subredditName
  );
};

const shuffleCommentIds = (
  ids: [string, string, string]
): [string, string, string] => {
  const shuffled = [ids[0], ids[1], ids[2]];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    const swap = shuffled[swapIndex];
    if (current !== undefined && swap !== undefined) {
      shuffled[index] = swap;
      shuffled[swapIndex] = current;
    }
  }
  return [shuffled[0]!, shuffled[1]!, shuffled[2]!];
};

const advanceSkip = async (
  userId: string | undefined,
  campaignCtx: CampaignContext,
  currentRankIndex: number
): Promise<number> => {
  if (userId !== undefined) {
    return advanceRankIndex(userId, campaignCtx);
  }
  return currentRankIndex + 1;
};

const attemptCampaignContext = (attempt: PuzzleAttempt): CampaignContext => ({
  subredditName: attempt.subreddit,
  timeframe: attempt.timeframe,
});

const submitError = (
  code: PuzzleSubmitErrorCode,
  message: string,
  nextAction: PuzzleSubmitError['nextAction'],
  currentRankIndex?: number
): PuzzleSubmitError => ({
  status: 'error',
  code,
  message,
  nextAction,
  ...(currentRankIndex !== undefined ? { currentRankIndex } : {}),
});

const skipError = (
  code: PuzzleSkipError['code'],
  message: string,
  nextAction: PuzzleSkipError['nextAction'],
  currentRankIndex?: number
): PuzzleSkipError => ({
  status: 'error',
  code,
  message,
  nextAction,
  ...(currentRankIndex !== undefined ? { currentRankIndex } : {}),
});

const forfeitError = (
  code: PuzzleForfeitError['code'],
  message: string,
  nextAction: PuzzleForfeitError['nextAction'],
  currentRankIndex?: number
): PuzzleForfeitError => ({
  status: 'error',
  code,
  message,
  nextAction,
  ...(currentRankIndex !== undefined ? { currentRankIndex } : {}),
});

const isIssuedCommentPermutation = (
  slots: [string, string, string],
  commentOrder: [string, string, string]
): boolean => {
  const slotSet = new Set(slots);
  if (slotSet.size !== 3) return false;
  return commentOrder.every((commentId) => slotSet.has(commentId));
};

const isIssuedCommentId = (
  commentId: string,
  commentOrder: [string, string, string]
): boolean => commentOrder.includes(commentId);

const buildRevealSlots = (
  slots: [string, string, string],
  snapshot: PuzzleSnapshot
) =>
  slots.map((commentId, index) => {
    const truth = snapshot.comments[index];
    if (truth === undefined) {
      throw new Error(`Missing snapshot comment at index ${index}`);
    }
    const comment = snapshot.comments.find((entry) => entry.id === commentId);
    return {
      commentId,
      body: comment?.body ?? '',
      score: comment?.score ?? 0,
      correct: commentId === truth.id,
    };
  });

const buildTruthRevealSlots = (snapshot: PuzzleSnapshot) =>
  snapshot.comments.map((comment) => ({
    commentId: comment.id,
    body: comment.body,
    score: comment.score,
    correct: true,
  }));

const buildForfeitRevealSlots = (snapshot: PuzzleSnapshot): PuzzleRevealSlot[] =>
  snapshot.comments.map((comment) => ({
    commentId: comment.id,
    body: comment.body,
    score: comment.score,
    correct: false,
  }));

const buildCasualRevealSlots = (
  selectedCommentId: string,
  snapshot: PuzzleSnapshot
): PuzzleRevealSlot[] => {
  const topCommentId = snapshot.comments[0]?.id;
  return snapshot.comments.map((comment) => ({
    commentId: comment.id,
    body: comment.body,
    score: comment.score,
    correct: selectedCommentId === topCommentId && comment.id === topCommentId,
  }));
};

const scoreExpertSubmit = (
  slots: [string, string, string],
  snapshot: PuzzleSnapshot
): { score: number; statsDelta: RoundStatsDelta; revealSlots: PuzzleRevealSlot[] } => {
  const score = slots.reduce<number>((total, commentId, index) => {
    const truthComment = snapshot.comments[index];
    if (truthComment === undefined) {
      return total;
    }
    return total + (commentId === truthComment.id ? 1 : 0);
  }, 0);

  return {
    score,
    statsDelta: { correctSlots: score, coinAward: score },
    revealSlots: buildRevealSlots(slots, snapshot),
  };
};

const scoreCasualSubmit = (
  selectedCommentId: string,
  snapshot: PuzzleSnapshot
): { score: number; statsDelta: RoundStatsDelta; revealSlots: PuzzleRevealSlot[] } => {
  const trueRankIndex = snapshot.comments.findIndex(
    (comment) => comment.id === selectedCommentId
  );
  const coinAward = CASUAL_COIN_AWARDS[trueRankIndex] ?? 0;

  return {
    score: coinAward,
    statsDelta: {
      correctSlots: trueRankIndex === 0 ? 1 : 0,
      coinAward,
    },
    revealSlots: buildCasualRevealSlots(selectedCommentId, snapshot),
  };
};

const puzzleSubmitInputSchema = z.discriminatedUnion('gameMode', [
  z.object({
    gameMode: z.literal('expert'),
    attemptId: z.string().min(1),
    slots: z.tuple([
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
    ]),
  }),
  z.object({
    gameMode: z.literal('casual'),
    attemptId: z.string().min(1),
    selectedCommentId: z.string().min(1),
  }),
]);

type ResolvedPostMedia = {
  imageUrl?: string;
  galleryUrls?: string[];
  isVideo?: boolean;
};

const enrichSnapshotMedia = (
  snapshot: PuzzleSnapshot,
  resolvedMedia: ResolvedPostMedia
): PuzzleSnapshot => {
  if (
    resolvedMedia.galleryUrls === undefined &&
    resolvedMedia.imageUrl === undefined
  ) {
    return snapshot;
  }

  const post = { ...snapshot.post };
  if (resolvedMedia.isVideo) {
    post.imageUrl = resolvedMedia.imageUrl;
    post.isVideo = true;
    delete post.galleryUrls;
  } else if (
    resolvedMedia.galleryUrls !== undefined &&
    resolvedMedia.galleryUrls.length > 0
  ) {
    post.galleryUrls = resolvedMedia.galleryUrls;
    post.imageUrl = resolvedMedia.galleryUrls[0];
    delete post.isVideo;
  } else if (resolvedMedia.imageUrl !== undefined) {
    post.imageUrl = resolvedMedia.imageUrl;
    delete post.isVideo;
  }

  return {
    ...snapshot,
    post,
  };
};

const buildReadyResponse = (
  attemptId: string,
  rankIndex: number,
  subredditDisplayName: string,
  postUrl: string,
  snapshot: PuzzleSnapshot,
  commentOrder: [string, string, string]
): Extract<PuzzleNextResponse, { status: 'ready' }> => {
  const commentById = new Map(
    snapshot.comments.map((comment) => [comment.id, comment])
  );

  const post: Extract<PuzzleNextResponse, { status: 'ready' }>['post'] = {
    title: snapshot.post.title,
  };
  if (snapshot.post.body !== undefined) {
    post.body = snapshot.post.body;
  }
  if (snapshot.post.contentBlocks !== undefined) {
    post.contentBlocks = snapshot.post.contentBlocks;
  }
  if (snapshot.post.imageUrl !== undefined) {
    post.imageUrl = snapshot.post.imageUrl;
  }
  if (snapshot.post.galleryUrls !== undefined) {
    post.galleryUrls = snapshot.post.galleryUrls;
  }
  if (snapshot.post.isVideo !== undefined) {
    post.isVideo = snapshot.post.isVideo;
  }

  return {
    status: 'ready',
    attemptId,
    rankIndex,
    subredditDisplayName,
    postUrl,
    post,
    numberOfComments: snapshot.numberOfComments ?? 0,
    comments: commentOrder.map((commentId) => {
      const comment = commentById.get(commentId);
      if (comment === undefined) {
        throw new Error(`Missing snapshot comment for id ${commentId}`);
      }
      return { id: comment.id, body: comment.body };
    }),
  };
};

export const puzzleRouter = router({
  next: publicProcedure
    .input(
      z.object({
        subreddit: z.string().optional(),
        timeframe: z.enum(CAMPAIGN_TIMEFRAME_IDS).optional(),
        rankIndex: z.number().int().min(1).optional(),
        gameMode: z.enum(['casual', 'expert']).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<PuzzleNextResponse> => {
      const launchContext = deriveLaunchContext(ctx.subredditName, ctx.surface);
      const campaignResult = resolveCampaignContext(launchContext, input);
      if (!campaignResult.ok) {
        return {
          status: 'error',
          code: campaignResult.code,
          message:
            campaignResult.code === 'SUBREDDIT_REQUIRED'
              ? 'A subreddit is required for Hub gameplay.'
              : campaignResult.code === 'TIMEFRAME_REQUIRED'
                ? 'A campaign timeframe is required.'
                : 'Gameplay is locked to the host community subreddit.',
        };
      }

      const campaignCtx = campaignResult.ctx;
      const subreddit = campaignCtx.subredditName;

      const attemptGameMode =
        ctx.userId !== undefined
          ? await getGameMode(ctx.userId)
          : (input.gameMode ?? DEFAULT_GAME_MODE);

      const metadata = await resolveSubredditMetadata(subreddit, ctx.reddit);
      if (launchContext.surface === 'hub' && metadata === null) {
        return {
          status: 'error',
          code: 'SUBREDDIT_UNAVAILABLE',
          message: 'Subreddit does not exist or is inaccessible.',
        };
      }

      const campaignDisplayName =
        metadata?.displayName ??
        CURATED_SUBREDDITS.find((entry) => entry.name === subreddit)
          ?.subreddit ??
        subreddit;

      let rankIndex =
        ctx.userId !== undefined
          ? await getRankIndex(ctx.userId, campaignCtx)
          : (input.rankIndex ?? 1);

      const budget: NextWorkBudget = {
        redditCallsRemaining: MAX_REDDIT_CALLS,
        softDeadlineAt: Date.now() + SOFT_DEADLINE_MS,
        itemsCheckedRemaining: MAX_ITEMS_CHECKED,
      };

      while (budget.itemsCheckedRemaining > 0) {
        const ladderResult = await resolveLadderPage(
          campaignCtx,
          rankIndex,
          budget,
          ctx.reddit
        );

        if (ladderResult.kind === 'unplayable') {
          return {
            status: 'unplayable',
            rankIndex: ladderResult.continuationRankIndex,
            message: UNPLAYABLE_MESSAGE,
          };
        }

        if (ladderResult.kind === 'exhausted') {
          return {
            status: 'exhausted',
            rankIndex,
            message: EXHAUSTED_MESSAGE,
          };
        }

        if (ladderResult.kind === 'error') {
          return {
            status: 'unplayable',
            rankIndex,
            message: UNPLAYABLE_MESSAGE,
          };
        }

        const { page, offset } = ladderResult;
        const post = page.posts[offset];

        if (post === undefined) {
          const isTerminal =
            page.nextAfter === null ||
            page.posts.length < resolveCampaignLadderPageSize(campaignCtx);
          if (isTerminal) {
            return {
              status: 'exhausted',
              rankIndex,
              message: EXHAUSTED_MESSAGE,
            };
          }
          return {
            status: 'unplayable',
            rankIndex,
            message: UNPLAYABLE_MESSAGE,
          };
        }

        if (!fastFilterEligible(post)) {
          budget.itemsCheckedRemaining -= 1;
          rankIndex = await advanceSkip(ctx.userId, campaignCtx, rankIndex);
          continue;
        }

        const postPayload: {
          title: string;
          body?: string;
          contentBlocks?: Extract<
            PuzzleNextResponse,
            { status: 'ready' }
          >['post']['contentBlocks'];
          imageUrl?: string;
          galleryUrls?: string[];
          isVideo?: boolean;
        } = {
          title: post.title,
        };

        let resolvedPost;
        try {
          resolvedPost = await ctx.reddit.getPostById(post.id);
        } catch {
          resolvedPost = undefined;
        }

        if (resolvedPost !== undefined) {
          const resolvedContent = resolvePostContent(resolvedPost);
          if (resolvedContent.body !== undefined) {
            postPayload.body = resolvedContent.body;
          }
          if (
            resolvedContent.contentBlocks !== undefined &&
            resolvedContent.contentBlocks.length > 0
          ) {
            postPayload.contentBlocks = resolvedContent.contentBlocks;
          }
        }

        const videoUrl =
          resolvedPost !== undefined
            ? getVideoFallbackUrl(resolvedPost)
            : post.isVideo
              ? post.imageUrl
              : undefined;

        if (videoUrl !== undefined) {
          postPayload.imageUrl = videoUrl;
          postPayload.isVideo = true;
        } else {
          const galleryUrls = await resolvePostGalleryUrls(
            post.galleryUrls,
            post.id,
            ctx.reddit
          );
          if (galleryUrls !== undefined && galleryUrls.length > 0) {
            postPayload.imageUrl = galleryUrls[0];
            if (galleryUrls.length > 1) {
              postPayload.galleryUrls = galleryUrls;
            }
          } else {
            const imageUrl = await resolvePostImageUrl(
              post.imageUrl,
              post.id,
              ctx.reddit
            );
            if (imageUrl !== undefined) {
              postPayload.imageUrl = imageUrl;
            }
          }
        }

        const validation = await validateComments(
          {
            sourcePostId: post.id,
            post: postPayload,
            numberOfComments: post.commentCount ?? 0,
          },
          ctx.reddit,
          budget
        );

        if (validation.kind === 'unplayable' || validation.kind === 'error') {
          return {
            status: 'unplayable',
            rankIndex,
            message: UNPLAYABLE_MESSAGE,
          };
        }

        if (validation.kind === 'invalid') {
          budget.itemsCheckedRemaining -= 1;
          rankIndex = await advanceSkip(ctx.userId, campaignCtx, rankIndex);
          continue;
        }

        const snapshot = enrichSnapshotMedia(validation.snapshot, postPayload);
        const attemptId = randomUUID();
        const trueOrder: [string, string, string] = [
          snapshot.comments[0].id,
          snapshot.comments[1].id,
          snapshot.comments[2].id,
        ];
        const commentOrder = shuffleCommentIds(trueOrder);

        const owner: PuzzleAttemptOwner =
          ctx.userId !== undefined
            ? { kind: 'user', userId: ctx.userId }
            : { kind: 'guest' };

        const now = Date.now();
        await setAttempt({
          attemptId,
          sourcePostId: snapshot.sourcePostId,
          subreddit,
          timeframe: campaignCtx.timeframe,
          rankIndex,
          owner,
          commentOrder,
          gameMode: attemptGameMode,
          submitted: false,
          createdAt: now,
          expiresAt: now + ATTEMPT_TTL_S * 1000,
        });

        const subredditDisplayName = isDailyChallengeSubreddit(subreddit)
          ? await resolveSubredditDisplayName(
              post.sourceSubredditName,
              ctx.reddit
            )
          : campaignDisplayName;

        return buildReadyResponse(
          attemptId,
          rankIndex,
          subredditDisplayName,
          resolveLadderPostUrl(post),
          snapshot,
          commentOrder
        );
      }

      return {
        status: 'unplayable',
        rankIndex,
        message: UNPLAYABLE_MESSAGE,
      };
    }),

  submit: publicProcedure
    .input(puzzleSubmitInputSchema)
    .mutation(async ({ input, ctx }): Promise<PuzzleSubmitResponse> => {
      const attempt = await getAttempt(input.attemptId);
      if (attempt === null) {
        return submitError(
          'ATTEMPT_EXPIRED',
          'This puzzle attempt has expired.',
          'request_next_puzzle'
        );
      }

      if (attempt.submitted) {
        return submitError(
          'ATTEMPT_ALREADY_SUBMITTED',
          'This puzzle round has already been submitted.',
          'request_next_puzzle'
        );
      }

      const launchContext = deriveLaunchContext(ctx.subredditName, ctx.surface);
      if (
        launchContext.surface === 'community' &&
        attempt.subreddit !== launchContext.hostSubreddit
      ) {
        return submitError(
          'HOST_SUBREDDIT_LOCKED',
          'Submit rejected: attempt subreddit does not match host.',
          'refresh_game'
        );
      }

      if (attempt.owner.kind === 'user') {
        if (ctx.userId === undefined || ctx.userId !== attempt.owner.userId) {
          return submitError(
            'WRONG_USER',
            'Submit rejected: user does not match attempt owner.',
            'refresh_game'
          );
        }

        const currentRankIndex = await getRankIndex(
          attempt.owner.userId,
          attemptCampaignContext(attempt)
        );
        if (currentRankIndex !== attempt.rankIndex) {
          return submitError(
            'STALE_PROGRESS',
            'Your progress has moved on; request a fresh puzzle.',
            'request_next_puzzle',
            currentRankIndex
          );
        }
      }

      const snapshot = await getSnapshot(attempt.sourcePostId);
      if (snapshot === null) {
        return submitError(
          'SNAPSHOT_MISSING',
          'Puzzle snapshot is unavailable; request a fresh puzzle.',
          'request_next_puzzle'
        );
      }

      if (input.gameMode !== attempt.gameMode) {
        return submitError(
          'INVALID_SLOT_PERMUTATION',
          'Submit gameMode does not match attempt gameMode.',
          'resubmit_valid_slots'
        );
      }

      if (input.gameMode === 'expert') {
        if (!isIssuedCommentPermutation(input.slots, attempt.commentOrder)) {
          return submitError(
            'INVALID_SLOT_PERMUTATION',
            'Submitted slots must be a permutation of the issued comment IDs.',
            'resubmit_valid_slots'
          );
        }
      } else if (
        !isIssuedCommentId(input.selectedCommentId, attempt.commentOrder)
      ) {
        return submitError(
          'INVALID_SELECTED_COMMENT',
          'Selected comment must be one of the issued comment IDs.',
          'resubmit_valid_slots'
        );
      }

      const lockAcquired = await acquireSubmitLock(input.attemptId);
      if (!lockAcquired) {
        return submitError(
          'ATTEMPT_ALREADY_SUBMITTED',
          'A duplicate submit was detected.',
          'request_next_puzzle'
        );
      }

      const scored =
        input.gameMode === 'expert'
          ? scoreExpertSubmit(input.slots, snapshot)
          : scoreCasualSubmit(input.selectedCommentId, snapshot);

      await markAttemptSubmitted(attempt);

      let nextRankIndex: number;
      let userHiveIQ: UserActiveSubredditMetrics | null;
      let coins: number | null = null;

      if (attempt.owner.kind === 'user') {
        const attemptCtx = attemptCampaignContext(attempt);
        const updatedCoins = await incrementStats(
          attempt.owner.userId,
          attemptCtx,
          scored.statsDelta
        );
        coins = updatedCoins;
        nextRankIndex = await advanceRankIndex(attempt.owner.userId, attemptCtx);
        await updateLeaderboard(attemptCtx, attempt.owner.userId, attempt.rankIndex);
        const submitUsername = await ctx.reddit.getCurrentUsername();
        if (submitUsername !== undefined) {
          await upsertUsername(attempt.owner.userId, submitUsername);
        }

        const stats = await getStats(attempt.owner.userId);
        const aggregateStats = getSubredditAggregate(stats, attempt.subreddit);
        userHiveIQ = {
          userSubredditHiveIQ: computeHiveIQ(
            aggregateStats.correctSlots,
            aggregateStats.totalSlots
          ),
          currentRankIndex: nextRankIndex,
          activeTimeframe: attempt.timeframe,
        };
      } else {
        nextRankIndex = attempt.rankIndex + 1;
        userHiveIQ = null;
      }

      return {
        status: 'submitted',
        score: scored.score,
        slots: scored.revealSlots,
        userHiveIQ,
        nextRankIndex,
        coins,
      };
    }),

  skip: publicProcedure
    .input(
      z.object({
        attemptId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }): Promise<PuzzleSkipResponse> => {
      const attempt = await getAttempt(input.attemptId);
      if (attempt === null) {
        return skipError(
          'ATTEMPT_EXPIRED',
          'This puzzle attempt has expired.',
          'request_next_puzzle'
        );
      }

      if (attempt.submitted) {
        return skipError(
          'ATTEMPT_ALREADY_SUBMITTED',
          'This puzzle round has already been submitted.',
          'request_next_puzzle'
        );
      }

      const launchContext = deriveLaunchContext(ctx.subredditName, ctx.surface);
      if (
        launchContext.surface === 'community' &&
        attempt.subreddit !== launchContext.hostSubreddit
      ) {
        return skipError(
          'HOST_SUBREDDIT_LOCKED',
          'Skip rejected: attempt subreddit does not match host.',
          'refresh_game'
        );
      }

      if (attempt.owner.kind === 'user') {
        if (ctx.userId === undefined || ctx.userId !== attempt.owner.userId) {
          return skipError(
            'WRONG_USER',
            'Skip rejected: user does not match attempt owner.',
            'refresh_game'
          );
        }

        const currentRankIndex = await getRankIndex(
          attempt.owner.userId,
          attemptCampaignContext(attempt)
        );
        if (currentRankIndex !== attempt.rankIndex) {
          return skipError(
            'STALE_PROGRESS',
            'Your progress has moved on; request a fresh puzzle.',
            'request_next_puzzle',
            currentRankIndex
          );
        }
      }

      if (attempt.owner.kind === 'user') {
        const stats = await getStats(attempt.owner.userId);
        if (stats.coins < 1) {
          return skipError(
            'INSUFFICIENT_COINS',
            'You need at least 1 Karma Coin to skip this puzzle.',
            'resubmit_valid_slots'
          );
        }
      }

      const snapshot = await getSnapshot(attempt.sourcePostId);
      if (snapshot === null) {
        return skipError(
          'SNAPSHOT_MISSING',
          'Puzzle snapshot is unavailable; request a fresh puzzle.',
          'request_next_puzzle'
        );
      }

      const lockAcquired = await acquireSubmitLock(input.attemptId);
      if (!lockAcquired) {
        return skipError(
          'ATTEMPT_ALREADY_SUBMITTED',
          'A duplicate skip was detected.',
          'request_next_puzzle'
        );
      }

      let coins: number | null = null;

      if (attempt.owner.kind === 'user') {
        const deduction = await deductCoin(attempt.owner.userId);
        if (!deduction.ok) {
          return skipError(
            'INSUFFICIENT_COINS',
            'You need at least 1 Karma Coin to skip this puzzle.',
            'resubmit_valid_slots'
          );
        }
        coins = deduction.coins;
      }

      await markAttemptSubmitted(attempt);

      const nextRankIndex =
        attempt.owner.kind === 'user'
          ? await advanceRankIndex(
              attempt.owner.userId,
              attemptCampaignContext(attempt)
            )
          : attempt.rankIndex + 1;

      return {
        status: 'skipped',
        score: 0,
        slots: buildTruthRevealSlots(snapshot),
        userHiveIQ: null,
        nextRankIndex,
        coins,
      };
    }),

  forfeit: publicProcedure
    .input(
      z.object({
        attemptId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }): Promise<PuzzleForfeitResponse> => {
      const attempt = await getAttempt(input.attemptId);
      if (attempt === null) {
        return forfeitError(
          'ATTEMPT_EXPIRED',
          'This puzzle attempt has expired.',
          'request_next_puzzle'
        );
      }

      if (attempt.submitted) {
        return forfeitError(
          'ATTEMPT_ALREADY_SUBMITTED',
          'This puzzle round has already been submitted.',
          'request_next_puzzle'
        );
      }

      if (attempt.gameMode !== 'casual') {
        return forfeitError(
          'EXPERT_MODE_FORFEIT_NOT_ALLOWED',
          'Forfeit is only available in casual mode.',
          'resubmit_valid_slots'
        );
      }

      const launchContext = deriveLaunchContext(ctx.subredditName, ctx.surface);
      if (
        launchContext.surface === 'community' &&
        attempt.subreddit !== launchContext.hostSubreddit
      ) {
        return forfeitError(
          'HOST_SUBREDDIT_LOCKED',
          'Forfeit rejected: attempt subreddit does not match host.',
          'refresh_game'
        );
      }

      if (attempt.owner.kind === 'user') {
        if (ctx.userId === undefined || ctx.userId !== attempt.owner.userId) {
          return forfeitError(
            'WRONG_USER',
            'Forfeit rejected: user does not match attempt owner.',
            'refresh_game'
          );
        }

        const currentRankIndex = await getRankIndex(
          attempt.owner.userId,
          attemptCampaignContext(attempt)
        );
        if (currentRankIndex !== attempt.rankIndex) {
          return forfeitError(
            'STALE_PROGRESS',
            'Your progress has moved on; request a fresh puzzle.',
            'request_next_puzzle',
            currentRankIndex
          );
        }
      }

      const snapshot = await getSnapshot(attempt.sourcePostId);
      if (snapshot === null) {
        return forfeitError(
          'SNAPSHOT_MISSING',
          'Puzzle snapshot is unavailable; request a fresh puzzle.',
          'request_next_puzzle'
        );
      }

      const lockAcquired = await acquireSubmitLock(input.attemptId);
      if (!lockAcquired) {
        return forfeitError(
          'ATTEMPT_ALREADY_SUBMITTED',
          'A duplicate forfeit was detected.',
          'request_next_puzzle'
        );
      }

      const statsDelta: RoundStatsDelta = { correctSlots: 0, coinAward: 0 };

      await markAttemptSubmitted(attempt);

      let nextRankIndex: number;
      let userHiveIQ: UserActiveSubredditMetrics | null;
      let coins: number | null = null;

      if (attempt.owner.kind === 'user') {
        const attemptCtx = attemptCampaignContext(attempt);
        coins = await incrementStats(
          attempt.owner.userId,
          attemptCtx,
          statsDelta
        );
        nextRankIndex = await advanceRankIndex(attempt.owner.userId, attemptCtx);
        await updateLeaderboard(attemptCtx, attempt.owner.userId, attempt.rankIndex);

        const stats = await getStats(attempt.owner.userId);
        const aggregateStats = getSubredditAggregate(stats, attempt.subreddit);
        userHiveIQ = {
          userSubredditHiveIQ: computeHiveIQ(
            aggregateStats.correctSlots,
            aggregateStats.totalSlots
          ),
          currentRankIndex: nextRankIndex,
          activeTimeframe: attempt.timeframe,
        };
      } else {
        nextRankIndex = attempt.rankIndex + 1;
        userHiveIQ = null;
      }

      return {
        status: 'forfeited',
        score: 0,
        slots: buildForfeitRevealSlots(snapshot),
        userHiveIQ,
        nextRankIndex,
        coins,
      };
    }),

  devResetRankIndex: publicProcedure
    .input(
      z.object({
        subreddit: z.string(),
        timeframe: z.enum(CAMPAIGN_TIMEFRAME_IDS),
        rankIndex: z.number().int().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isDevPlaytestHost(ctx.subredditName)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Dev-only endpoint',
        });
      }

      if (ctx.userId === undefined) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Login required',
        });
      }

      const subreddit = normalizeSubredditName(input.subreddit);
      if (!subreddit) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid subreddit',
        });
      }

      await setRankIndex(ctx.userId, { subredditName: subreddit, timeframe: input.timeframe }, input.rankIndex);
      return { ok: true as const };
    }),
});
