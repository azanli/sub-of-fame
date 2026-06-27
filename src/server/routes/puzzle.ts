import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { deriveLaunchContext, resolveRequestedSubreddit } from '../launchContext';
import { resolveSubredditMetadata } from '../reddit/resolveSubredditMetadata';
import { fastFilterEligible, resolveLadderPage } from '../reddit/ladderPipeline';
import { validateComments } from '../reddit/commentValidation';
import { getProgress, incrementProgress } from '../redis/progressStore';
import { setAttempt } from '../redis/attemptStore';
import { ATTEMPT_TTL_S } from '../redis/keys';
import type { PuzzleAttemptOwner, PuzzleSnapshot } from '../redis/types';
import {
  MAX_ITEMS_CHECKED,
  MAX_REDDIT_CALLS,
  SOFT_DEADLINE_MS,
  type NextWorkBudget,
  type PuzzleNextResponse,
} from '../../shared/api';

const UNPLAYABLE_MESSAGE =
  'Could not find a playable puzzle within the current request budget. Retry to continue.';
const EXHAUSTED_MESSAGE = 'No more playable posts remain on this subreddit ladder.';

const shuffleCommentIds = (ids: [string, string, string]): [string, string, string] => {
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
  subreddit: string,
  currentRankIndex: number
): Promise<number> => {
  if (userId !== undefined) {
    return incrementProgress(userId, subreddit);
  }
  return currentRankIndex + 1;
};

const buildReadyResponse = (
  attemptId: string,
  rankIndex: number,
  snapshot: PuzzleSnapshot,
  commentOrder: [string, string, string]
): Extract<PuzzleNextResponse, { status: 'ready' }> => {
  const commentById = new Map(snapshot.comments.map((comment) => [comment.id, comment]));

  const post: Extract<PuzzleNextResponse, { status: 'ready' }>['post'] = {
    title: snapshot.post.title,
  };
  if (snapshot.post.body !== undefined) {
    post.body = snapshot.post.body;
  }
  if (snapshot.post.imageUrl !== undefined) {
    post.imageUrl = snapshot.post.imageUrl;
  }

  return {
    status: 'ready',
    attemptId,
    rankIndex,
    post,
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
        rankIndex: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<PuzzleNextResponse> => {
      const launchContext = deriveLaunchContext(ctx.subredditName, ctx.surface);
      const subredditResult = resolveRequestedSubreddit(launchContext, input.subreddit);

      if (!subredditResult.ok) {
        return {
          status: 'error',
          code: subredditResult.code,
          message:
            subredditResult.code === 'SUBREDDIT_REQUIRED'
              ? 'A subreddit is required for Hub gameplay.'
              : 'Gameplay is locked to the host community subreddit.',
        };
      }

      const subreddit = subredditResult.subreddit;

      if (launchContext.surface === 'hub') {
        const metadata = await resolveSubredditMetadata(subreddit, ctx.reddit);
        if (metadata === null) {
          return {
            status: 'error',
            code: 'SUBREDDIT_UNAVAILABLE',
            message: 'Subreddit does not exist or is inaccessible.',
          };
        }
      }

      let rankIndex =
        ctx.userId !== undefined
          ? await getProgress(ctx.userId, subreddit)
          : (input.rankIndex ?? 1);

      const budget: NextWorkBudget = {
        redditCallsRemaining: MAX_REDDIT_CALLS,
        softDeadlineAt: Date.now() + SOFT_DEADLINE_MS,
        itemsCheckedRemaining: MAX_ITEMS_CHECKED,
      };

      while (budget.itemsCheckedRemaining > 0) {
        const ladderResult = await resolveLadderPage(subreddit, rankIndex, budget, ctx.reddit);

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
          const isTerminal = page.nextAfter === null || page.posts.length < 100;
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
          rankIndex = await advanceSkip(ctx.userId, subreddit, rankIndex);
          continue;
        }

        const postPayload: { title: string; body?: string; imageUrl?: string } = {
          title: post.title,
        };
        if (post.imageUrl !== undefined) {
          postPayload.imageUrl = post.imageUrl;
        }

        const validation = await validateComments(
          { sourcePostId: post.id, post: postPayload },
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
          rankIndex = await advanceSkip(ctx.userId, subreddit, rankIndex);
          continue;
        }

        const snapshot = validation.snapshot;
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
          rankIndex,
          owner,
          commentOrder,
          submitted: false,
          createdAt: now,
          expiresAt: now + ATTEMPT_TTL_S * 1000,
        });

        return buildReadyResponse(attemptId, rankIndex, snapshot, commentOrder);
      }

      return {
        status: 'unplayable',
        rankIndex,
        message: UNPLAYABLE_MESSAGE,
      };
    }),
});
