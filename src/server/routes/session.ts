import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc';
import { deriveLaunchContext, normalizeSubredditName } from '../launchContext';
import { resolveSubredditMetadata } from '../reddit/resolveSubredditMetadata';
import { getAllProgress } from '../redis/progressStore';
import { getRankIndex } from '../redis/rankProgress';
import { resolveLadderPage } from '../reddit/ladderPipeline';
import { SOFT_DEADLINE_MS } from '../../shared/api';
import { SUBREDDIT_UNLOCK_COST } from '../../shared/coins';
import { CURATED_SUBREDDITS } from '../../shared/subreddits';
import { isDailyChallengeSubreddit } from '../../shared/dailyChallenge';
import { deductCoins, getStats } from '../redis/statsStore';

const WARM_DEADLINE_MS = Math.min(3000, SOFT_DEADLINE_MS);

const curatedSubredditSet = new Set(CURATED_SUBREDDITS.map((entry) => entry.name));

const requiresUnlockPayment = async (
  userId: string,
  subreddit: string
): Promise<boolean> => {
  if (curatedSubredditSet.has(subreddit)) {
    return false;
  }

  if (isDailyChallengeSubreddit(subreddit)) {
    return false;
  }

  const [progress, stats] = await Promise.all([getAllProgress(userId), getStats(userId)]);

  if (subreddit in progress) {
    return false;
  }

  if ((stats.bySubreddit[subreddit]?.totalSlots ?? 0) > 0) {
    return false;
  }

  return true;
};

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

      let coins: number | null = null;

      if (ctx.userId !== undefined) {
        const shouldChargeUnlock = await requiresUnlockPayment(ctx.userId, subreddit);

        if (shouldChargeUnlock) {
          const stats = await getStats(ctx.userId);
          if (stats.coins < SUBREDDIT_UNLOCK_COST) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'INSUFFICIENT_COINS',
            });
          }

          const deduction = await deductCoins(ctx.userId, SUBREDDIT_UNLOCK_COST);
          if (!deduction.ok) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'INSUFFICIENT_COINS',
            });
          }

          coins = deduction.coins;
        } else {
          coins = (await getStats(ctx.userId)).coins;
        }
      }

      const currentRankIndex = ctx.userId ? await getRankIndex(ctx.userId, subreddit) : 1;

      return {
        activeSubreddit: subreddit,
        currentRankIndex,
        subredditMetadata: metadata,
        coins,
      };
    }),
});
