import { Hono } from 'hono';

export const api = new Hono();

api.get('/init', async (c) => {});
