import { router } from './trpc';
import { initRouter } from './routes/init';
import { puzzleRouter } from './routes/puzzle';
import { sessionRouter } from './routes/session';

export const appRouter = router({
  init: initRouter.init,
  session: sessionRouter,
  puzzle: puzzleRouter,
});

export type AppRouter = typeof appRouter;
