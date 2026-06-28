import { context, reddit } from '@devvit/web/server';

export async function createGamePost() {
  const subredditName = context.subredditName;
  if (!subredditName) {
    throw new Error('Missing subreddit context');
  }

  return reddit.submitCustomPost({
    subredditName,
    title: 'Sub of Fame',
    entry: 'default',
  });
}
