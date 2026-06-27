import { router } from './trpc';
import { sessionRouter } from './routes/session';

export const appRouter = router({
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
