import { initTRPC } from '@trpc/server';
import type { RedditClient } from '@devvit/reddit';
import { context as devvitContext, reddit } from '@devvit/web/server';
import { resolveRedditSurface } from './launchContext';

export type TRPCContext = {
  reddit: Pick<RedditClient, 'getSubredditInfoByName' | 'getSubredditStyles' | 'getTopPosts'>;
  userId: string | undefined;
  subredditName: string;
  surface: string;
};

export const createContext = (): TRPCContext => ({
  reddit,
  userId: devvitContext.userId,
  subredditName: devvitContext.subredditName ?? '',
  surface: resolveRedditSurface(devvitContext),
});

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
