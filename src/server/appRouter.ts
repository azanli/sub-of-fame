import { router } from './trpc';
import { initRouter } from './routes/init';
import { leaderboardRouter } from './routes/leaderboard';
import { puzzleRouter } from './routes/puzzle';
import { sessionRouter } from './routes/session';

export const appRouter = router({
  init: initRouter.init,
  leaderboard: leaderboardRouter,
  session: sessionRouter,
  puzzle: puzzleRouter,
});

export type AppRouter = typeof appRouter;
