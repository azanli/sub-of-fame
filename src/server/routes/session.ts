import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc';
import { deriveLaunchContext, normalizeSubredditName } from '../launchContext';
import { resolveSubredditMetadata } from '../reddit/resolveSubredditMetadata';
import { getRankIndex } from '../redis/rankProgress';
import { resolveLadderPage } from '../reddit/ladderPipeline';
import { SOFT_DEADLINE_MS } from '../../shared/api';

const WARM_DEADLINE_MS = Math.min(3000, SOFT_DEADLINE_MS);

export const sessionRouter = router({
  selectSubreddit: publicProcedure
    .input(z.object({ subreddit: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const launchContext = deriveLaunchContext(ctx.subredditName, ctx.surface);
      if (launchContext.surface === 'community') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'HOST_SUBREDDIT_LOCKED',
        });
      }

      const subreddit = normalizeSubredditName(input.subreddit);
      if (!subreddit) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'SUBREDDIT_UNAVAILABLE',
        });
      }

      const metadata = await resolveSubredditMetadata(subreddit, ctx.reddit);
      if (!metadata) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'SUBREDDIT_UNAVAILABLE',
        });
      }

      const warmBudget = {
        redditCallsRemaining: 1,
        softDeadlineAt: Date.now() + WARM_DEADLINE_MS,
        itemsCheckedRemaining: 0,
      };
      const warmResult = await resolveLadderPage(subreddit, 1, warmBudget, ctx.reddit);
      if (warmResult.kind !== 'hit') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'SUBREDDIT_UNAVAILABLE',
        });
      }

      const currentRankIndex = ctx.userId ? await getRankIndex(ctx.userId, subreddit) : 1;

      return {
        activeSubreddit: subreddit,
        currentRankIndex,
        subredditMetadata: metadata,
      };
    }),
});
