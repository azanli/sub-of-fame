import { redis } from '@devvit/web/server';

const profileKey = (userId: string): string => `user:${userId}:profile`;

const usernameField = (): string => 'username';

export const upsertUsername = async (
  userId: string,
  username: string
): Promise<void> => {
  if (username.length === 0) {
    return;
  }

  await redis.hSet(profileKey(userId), { [usernameField()]: username });
};

export const getUsername = async (userId: string): Promise<string | null> => {
  const raw = await redis.hGet(profileKey(userId), usernameField());
  return raw ?? null;
};

export const getUsernames = async (
  userIds: string[]
): Promise<Map<string, string | null>> => {
  const uniqueUserIds = [...new Set(userIds)];
  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => [userId, await getUsername(userId)] as const)
  );
  return new Map(entries);
};
