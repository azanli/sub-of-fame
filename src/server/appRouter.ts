import { router } from './trpc';
import { puzzleRouter } from './routes/puzzle';
import { sessionRouter } from './routes/session';

export const appRouter = router({
  session: sessionRouter,
  puzzle: puzzleRouter,
});

export type AppRouter = typeof appRouter;
