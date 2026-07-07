import { redis } from '@devvit/web/server';
import type { LeaderboardEntry } from '../../shared/api';
import type { CampaignContext } from '../../shared/campaignContext';
import {
  campaignLeaderboardKey,
  legacyLeaderboardKey,
  statsCampaignCorrectField,
  statsCampaignTotalField,
} from './campaignKeys';
import { statsKey } from './keys';
import { computeHiveIQ } from './statsStore';

const copyLegacyLeaderboardIfEmpty = async (ctx: CampaignContext): Promise<void> => {
  if (ctx.timeframe !== 'all') {
    return;
  }

  const newKey = campaignLeaderboardKey(ctx);
  const legacyKey = legacyLeaderboardKey(ctx.subredditName);
  const [newCount, legacyMembers] = await Promise.all([
    redis.zCard(newKey),
    redis.zRange(legacyKey, 0, -1, { by: 'rank' }),
  ]);

  if (newCount > 0 || legacyMembers.length === 0) {
    return;
  }

  await Promise.all(
    legacyMembers.map((member) =>
      redis.zAdd(newKey, { score: member.score, member: member.member })
    )
  );
};

export const updateLeaderboard = async (
  ctx: CampaignContext,
  userId: string,
  clearedRankIndex: number
): Promise<void> => {
  const key = campaignLeaderboardKey(ctx);
  const currentScore = await redis.zScore(key, userId);
  if (currentScore !== undefined && currentScore >= clearedRankIndex) return;
  await redis.zAdd(key, { score: clearedRankIndex, member: userId });
};

export const getLeaderboardRank = async (
  ctx: CampaignContext,
  userId: string
): Promise<number | null> => {
  await copyLegacyLeaderboardIfEmpty(ctx);

  const key = campaignLeaderboardKey(ctx);
  const userScore = await redis.zScore(key, userId);
  if (userScore === undefined) return null;

  const higher = await redis.zRange(key, userScore + 1, '+inf', { by: 'score' });
  return higher.length + 1;
};

export const getLeaderboardPage = async (
  ctx: CampaignContext,
  offset: number,
  count: number
): Promise<LeaderboardEntry[]> => {
  await copyLegacyLeaderboardIfEmpty(ctx);

  const key = campaignLeaderboardKey(ctx);
  const members = await redis.zRange(key, offset, offset + count - 1, {
    by: 'rank',
    reverse: true,
  });

  if (members.length === 0) return [];

  const entries: LeaderboardEntry[] = [];
  let displayRank = offset + 1;
  let prevScore: number | null = null;
  let tieDisplayRank = displayRank;

  for (const member of members) {
    const memberUserId = member.member;
    const bestClearedRankIndex = member.score;

    const statsFields = await redis.hGetAll(statsKey(memberUserId));
    const correctRaw = statsFields[statsCampaignCorrectField(ctx)];
    const totalRaw = statsFields[statsCampaignTotalField(ctx)];
    const correct = correctRaw !== undefined ? parseInt(correctRaw, 10) : 0;
    const total = totalRaw !== undefined ? parseInt(totalRaw, 10) : 0;
    const hiveIQ = computeHiveIQ(correct, total) ?? 0;

    if (prevScore !== null && bestClearedRankIndex === prevScore) {
      entries.push({
        userId: memberUserId,
        bestClearedRankIndex,
        userSubredditHiveIQ: hiveIQ,
        displayRank: tieDisplayRank,
      });
    } else {
      tieDisplayRank = displayRank;
      entries.push({
        userId: memberUserId,
        bestClearedRankIndex,
        userSubredditHiveIQ: hiveIQ,
        displayRank,
      });
    }

    prevScore = bestClearedRankIndex;
    displayRank++;
  }

  return entries;
};
