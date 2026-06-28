import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { createGamePost } from '../reddit/createGamePost';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  await c.req.json<MenuItemRequest>();

  try {
    const post = await createGamePost();

    return c.json<UiResponse>(
      {
        navigateTo: post.url,
        showToast: {
          text: 'Post created!',
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post. Please try again.',
      },
      200
    );
  }
});
