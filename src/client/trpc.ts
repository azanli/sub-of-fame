import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/appRouter';

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
    }),
  ],
});
