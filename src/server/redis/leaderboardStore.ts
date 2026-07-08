import { redis } from '@devvit/web/server';
import type { LeaderboardEntry } from '../../shared/api';
import type { CampaignContext } from '../../shared/campaignContext';
import {
  campaignLeaderboardKey,
  ecosystemLeaderboardKey,
  legacyLeaderboardKey,
  statsSubredditCorrectField,
  statsSubredditTotalField,
} from './campaignKeys';
import {
  statsGlobalCorrectField,
  statsGlobalTotalField,
  statsHighestStreakField,
  statsKey,
} from './keys';
import { getUsernames } from './profileStore';
import { computeHiveIQ } from './statsStore';

type HydratedMember = {
  userId: string;
  primaryScore: number;
  hiveIQ: number;
  completedRoundCount: number;
  highestStreak: number;
};

type StatsHydrationScope =
  | { kind: 'subreddit'; subredditName: string }
  | { kind: 'global' };

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

const parseHighestStreak = (statsFields: Record<string, string>): number => {
  const raw = statsFields[statsHighestStreakField()];
  if (raw === undefined) {
    return 0;
  }
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const hydrateMember = (
  userId: string,
  primaryScore: number,
  statsFields: Record<string, string>,
  scope: StatsHydrationScope
): HydratedMember => {
  const highestStreak = parseHighestStreak(statsFields);

  if (scope.kind === 'global') {
    const correct = parseInt(statsFields[statsGlobalCorrectField()] ?? '0', 10);
    const total = parseInt(statsFields[statsGlobalTotalField()] ?? '0', 10);
    return {
      userId,
      primaryScore,
      hiveIQ: computeHiveIQ(correct, total) ?? 0,
      completedRoundCount: Math.floor(total / 3),
      highestStreak,
    };
  }

  const correct = parseInt(
    statsFields[statsSubredditCorrectField(scope.subredditName)] ?? '0',
    10
  );
  const total = parseInt(
    statsFields[statsSubredditTotalField(scope.subredditName)] ?? '0',
    10
  );
  return {
    userId,
    primaryScore,
    hiveIQ: computeHiveIQ(correct, total) ?? 0,
    completedRoundCount: Math.floor(total / 3),
    highestStreak,
  };
};

const compareHydratedMembers = (a: HydratedMember, b: HydratedMember): number => {
  if (b.primaryScore !== a.primaryScore) {
    return b.primaryScore - a.primaryScore;
  }
  if (b.hiveIQ !== a.hiveIQ) {
    return b.hiveIQ - a.hiveIQ;
  }
  return a.userId.localeCompare(b.userId);
};

const assignDisplayRanks = (
  members: HydratedMember[],
  startIndex: number
): Array<HydratedMember & { displayRank: number }> => {
  const ranked: Array<HydratedMember & { displayRank: number }> = [];
  let position = startIndex + 1;

  for (let index = 0; index < members.length; index++) {
    const member = members[index];
    if (member === undefined) {
      continue;
    }

    if (index === 0) {
      ranked.push({ ...member, displayRank: position });
      continue;
    }

    const previous = members[index - 1];
    if (previous !== undefined && previous.primaryScore === member.primaryScore) {
      const previousRank = ranked[index - 1]?.displayRank ?? position;
      ranked.push({ ...member, displayRank: previousRank });
    } else {
      position = startIndex + index + 1;
      ranked.push({ ...member, displayRank: position });
    }
  }

  return ranked;
};

const buildLeaderboardPage = async (
  key: string,
  offset: number,
  count: number,
  scope: StatsHydrationScope,
  currentUserId: string | undefined
): Promise<LeaderboardEntry[]> => {
  const fetchCount = Math.max(count * 2, count);
  const members = await redis.zRange(key, offset, offset + fetchCount - 1, {
    by: 'rank',
    reverse: true,
  });

  if (members.length === 0) {
    return [];
  }

  const statsByUserId = await Promise.all(
    members.map(async (member) => ({
      userId: member.member,
      statsFields: await redis.hGetAll(statsKey(member.member)),
    }))
  );

  const hydrated = statsByUserId.map(({ userId, statsFields }) =>
    hydrateMember(
      userId,
      members.find((member) => member.member === userId)?.score ?? 0,
      statsFields,
      scope
    )
  );

  hydrated.sort(compareHydratedMembers);
  const pageMembers = hydrated.slice(0, count);
  const rankedMembers = assignDisplayRanks(pageMembers, offset);
  const usernames = await getUsernames(rankedMembers.map((member) => member.userId));

  return rankedMembers.map((member) => ({
    userId: member.userId,
    username: usernames.get(member.userId) ?? 'Redditor',
    bestClearedRankIndex: member.primaryScore,
    userSubredditHiveIQ: member.hiveIQ,
    completedRoundCount: member.completedRoundCount,
    highestStreak: member.highestStreak,
    displayRank: member.displayRank,
    isCurrentUser: currentUserId !== undefined && member.userId === currentUserId,
  }));
};

const buildLeaderboardRank = async (
  key: string,
  userId: string,
  scope: StatsHydrationScope
): Promise<number | null> => {
  const userScore = await redis.zScore(key, userId);
  if (userScore === undefined) {
    return null;
  }

  const tiedMembers = await redis.zRange(key, userScore, userScore, { by: 'score' });
  const higherMembers = await redis.zRange(key, userScore + 1, '+inf', { by: 'score' });

  const allMembers = [...higherMembers, ...tiedMembers];
  if (allMembers.length === 0) {
    return 1;
  }

  const statsByUserId = await Promise.all(
    allMembers.map(async (member) => ({
      userId: member.member,
      statsFields: await redis.hGetAll(statsKey(member.member)),
    }))
  );

  const hydrated = statsByUserId.map(({ userId: memberUserId, statsFields }) =>
    hydrateMember(
      memberUserId,
      allMembers.find((member) => member.member === memberUserId)?.score ?? 0,
      statsFields,
      scope
    )
  );

  hydrated.sort(compareHydratedMembers);
  const rankedMembers = assignDisplayRanks(hydrated, 0);
  const userEntry = rankedMembers.find((member) => member.userId === userId);
  if (userEntry === undefined) {
    return null;
  }

  const higherCount = rankedMembers.filter(
    (member) => compareHydratedMembers(member, userEntry) < 0
  ).length;

  return higherCount + 1;
};

const buildLeaderboardEntryForUser = async (
  key: string,
  userId: string,
  scope: StatsHydrationScope
): Promise<LeaderboardEntry | null> => {
  const userScore = await redis.zScore(key, userId);
  if (userScore === undefined) {
    return null;
  }

  const [statsFields, displayRank, usernames] = await Promise.all([
    redis.hGetAll(statsKey(userId)),
    buildLeaderboardRank(key, userId, scope),
    getUsernames([userId]),
  ]);

  if (displayRank === null) {
    return null;
  }

  const member = hydrateMember(userId, userScore, statsFields, scope);

  return {
    userId: member.userId,
    username: usernames.get(userId) ?? 'Redditor',
    bestClearedRankIndex: member.primaryScore,
    userSubredditHiveIQ: member.hiveIQ,
    completedRoundCount: member.completedRoundCount,
    highestStreak: member.highestStreak,
    displayRank,
    isCurrentUser: true,
  };
};

const buildLeaderboardDisplayPage = async (
  key: string,
  count: number,
  scope: StatsHydrationScope,
  currentUserId: string | undefined
): Promise<LeaderboardEntry[]> => {
  const entries = await buildLeaderboardPage(key, 0, count, scope, currentUserId);

  if (currentUserId === undefined || entries.some((entry) => entry.isCurrentUser)) {
    return entries;
  }

  const viewerEntry = await buildLeaderboardEntryForUser(key, currentUserId, scope);
  if (viewerEntry === null) {
    return entries;
  }

  return [...entries, viewerEntry];
};

export const updateLeaderboard = async (
  ctx: CampaignContext,
  userId: string,
  clearedRankIndex: number
): Promise<void> => {
  const key = campaignLeaderboardKey(ctx);
  const currentScore = await redis.zScore(key, userId);
  if (currentScore !== undefined && currentScore >= clearedRankIndex) {
    return;
  }

  const oldSubScore = currentScore ?? 0;
  await redis.zAdd(key, { score: clearedRankIndex, member: userId });

  const delta = clearedRankIndex - oldSubScore;
  if (delta <= 0) {
    return;
  }

  const ecosystemKey = ecosystemLeaderboardKey();
  const oldEcoScore = (await redis.zScore(ecosystemKey, userId)) ?? 0;
  await redis.zAdd(ecosystemKey, { score: oldEcoScore + delta, member: userId });
};

export const getLeaderboardRank = async (
  ctx: CampaignContext,
  userId: string
): Promise<number | null> => {
  await copyLegacyLeaderboardIfEmpty(ctx);

  return buildLeaderboardRank(
    campaignLeaderboardKey(ctx),
    userId,
    { kind: 'subreddit', subredditName: ctx.subredditName }
  );
};

export const getEcosystemLeaderboardRank = async (
  userId: string
): Promise<number | null> =>
  buildLeaderboardRank(ecosystemLeaderboardKey(), userId, { kind: 'global' });

export const getLeaderboardPage = async (
  ctx: CampaignContext,
  offset: number,
  count: number,
  currentUserId?: string
): Promise<LeaderboardEntry[]> => {
  await copyLegacyLeaderboardIfEmpty(ctx);

  return buildLeaderboardPage(
    campaignLeaderboardKey(ctx),
    offset,
    count,
    { kind: 'subreddit', subredditName: ctx.subredditName },
    currentUserId
  );
};

export const getEcosystemLeaderboardPage = async (
  offset: number,
  count: number,
  currentUserId?: string
): Promise<LeaderboardEntry[]> =>
  buildLeaderboardPage(
    ecosystemLeaderboardKey(),
    offset,
    count,
    { kind: 'global' },
    currentUserId
  );

export const getLeaderboardDisplayPage = async (
  ctx: CampaignContext,
  count: number,
  currentUserId?: string
): Promise<LeaderboardEntry[]> => {
  await copyLegacyLeaderboardIfEmpty(ctx);

  return buildLeaderboardDisplayPage(
    campaignLeaderboardKey(ctx),
    count,
    { kind: 'subreddit', subredditName: ctx.subredditName },
    currentUserId
  );
};

export const getEcosystemLeaderboardDisplayPage = async (
  count: number,
  currentUserId?: string
): Promise<LeaderboardEntry[]> =>
  buildLeaderboardDisplayPage(
    ecosystemLeaderboardKey(),
    count,
    { kind: 'global' },
    currentUserId
  );
