import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@devvit/reddit/models/Post.js': path.resolve(
        import.meta.dirname,
        'node_modules/@devvit/reddit/models/Post.js'
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
