import { initTRPC } from '@trpc/server';
import type { RedditClient } from '@devvit/reddit';
import { context as devvitContext, reddit } from '@devvit/web/server';
import { DEV_SPOOF_HOST_SUBREDDIT } from './config';
import { deriveLaunchContext, resolveRedditSurface } from './launchContext';

export type TRPCContext = {
  reddit: Pick<
    RedditClient,
    | 'getSubredditInfoByName'
    | 'getSubredditStyles'
    | 'getTopPosts'
    | 'getHotPosts'
    | 'getComments'
    | 'getCurrentUsername'
    | 'getPostById'
  >;
  userId: string | undefined;
  subredditName: string;
  surface: string;
};

export const createContext = (): TRPCContext => {
  const rawSubredditName = devvitContext.subredditName ?? '';
  const rawSurface = resolveRedditSurface(devvitContext);

  const subredditName = DEV_SPOOF_HOST_SUBREDDIT ?? rawSubredditName;
  const surface = DEV_SPOOF_HOST_SUBREDDIT ? 'community' : rawSurface;

  console.log('[launch-context]', {
    devvit: {
      subredditName: rawSubredditName,
      postId: devvitContext.postId,
      userId: devvitContext.userId,
      surface: rawSurface,
    },
    effective: { subredditName, surface },
    launchContext: deriveLaunchContext(subredditName, surface),
    spoofed: DEV_SPOOF_HOST_SUBREDDIT !== null,
  });

  return {
    reddit,
    userId: devvitContext.userId,
    subredditName,
    surface,
  };
};

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
