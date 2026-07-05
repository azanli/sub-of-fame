import type { PostContentBlock } from './postContent.js';

export type GameMode = 'casual' | 'expert';

export const DEFAULT_GAME_MODE: GameMode = 'casual';

/** Coin awards by true rank index (0 = #1, 1 = #2, 2 = #3) for casual mode. */
export const CASUAL_COIN_AWARDS = [3, 1, 0] as const;

export type RoundStatsDelta = {
  /** Hive IQ correct-slot counter; expert 0–3, casual 1 on perfect #1 pick else 0. */
  correctSlots: number;
  /** Karma Coins earned this round; expert matches correctSlots, casual uses CASUAL_COIN_AWARDS. */
  coinAward: number;
};

type PerformanceCounters = {
  correctSlots: number;
  totalSlots: number;
};

export type UserStatsProfile = {
  global: PerformanceCounters;
  bySubreddit: Record<string, PerformanceCounters>;
  coins: number;
};

export type UserGlobalHiveIQMetrics = {
  userGlobalHiveIQ: number | null; // Hive IQ score; null when global:total = 0
  totalCorrectSlots: number;
  totalSlots: number;
};

export type UserActiveSubredditMetrics = {
  userSubredditHiveIQ: number | null; // Hive IQ score; null when sub:total = 0
  currentRankIndex: number;
};

export type SubredditDisplayMetadata = {
  subreddit: string;
  displayName: string;
  iconUrl: string;
  metadataSource: 'curated' | 'reddit';
};

export type SubredditDashboardCard = SubredditDisplayMetadata & {
  currentRankIndex: number;
  userSubredditHiveIQ: number | null;
  completedRoundCount: number;
  leaderboardRank: number | null;
};

export type LeaderboardEntry = {
  userId: string;
  bestClearedRankIndex: number;
  userSubredditHiveIQ: number;
  displayRank: number;
};

export type LaunchContext =
  | { surface: 'hub'; hostSubreddit: 'suboffame' }
  | { surface: 'community'; hostSubreddit: string };

export type DailyChallengeMetrics = {
  subreddit: string;
  // Epoch ms of the next daily gauntlet reset (UTC midnight boundary).
  resetsAt: number;
};

export type InitResponse = {
  hostSubreddit: string;
  isHub: boolean;
  activeSubreddit: string | null;
  playerName: string;
  gameMode: GameMode;
  hasGameData: boolean;
  /** Logged-in wallet balance; null for guests. */
  coins: number | null;
  userGlobalHiveIQ: UserGlobalHiveIQMetrics | null;
  dashboardSubreddits: SubredditDashboardCard[] | null;
  activeSubredditMetrics: UserActiveSubredditMetrics | null;
  dailyChallenge: DailyChallengeMetrics | null;
};

export type SessionSubRequest = {
  subreddit: string;
};

export type SessionSubResponse = {
  activeSubreddit: string;
  currentRankIndex: number;
  subredditMetadata: SubredditDisplayMetadata;
  /** Updated wallet balance after an unlock charge; null for guests and free selections. */
  coins: number | null;
};

export type SessionSubError = {
  status: 'error';
  code:
    | 'SUBREDDIT_UNAVAILABLE'
    | 'HOST_SUBREDDIT_LOCKED'
    | 'INSUFFICIENT_COINS';
  message: string;
};

export type PuzzleNextRequest = {
  subreddit?: string;
  rankIndex?: number;
};

export type PuzzleNextResponse =
  | {
      status: 'ready';
      attemptId: string;
      rankIndex: number;
      subredditDisplayName: string;
      postUrl: string;
      post: {
        title: string;
        body?: string;
        contentBlocks?: PostContentBlock[];
        imageUrl?: string;
        galleryUrls?: string[];
        isVideo?: boolean;
      };
      numberOfComments: number;
      comments: Array<{ id: string; body: string }>;
    }
  | {
      status: 'exhausted';
      rankIndex: number;
      message: string;
    }
  | {
      status: 'unplayable';
      rankIndex: number;
      message: string;
    }
  | {
      status: 'error';
      code:
        | 'SUBREDDIT_REQUIRED'
        | 'SUBREDDIT_UNAVAILABLE'
        | 'HOST_SUBREDDIT_LOCKED';
      message: string;
    };

export type ExpertPuzzleSubmitRequest = {
  gameMode: 'expert';
  attemptId: string;
  /** Comment IDs placed into rank slots 1/2/3; must be a permutation of the issued comment IDs. */
  slots: [string, string, string];
};

export type CasualPuzzleSubmitRequest = {
  gameMode: 'casual';
  attemptId: string;
  /** The comment ID the player believes holds the #1 spot. */
  selectedCommentId: string;
};

export type PuzzleSubmitRequest =
  | ExpertPuzzleSubmitRequest
  | CasualPuzzleSubmitRequest;

export type PuzzleRevealSlot = {
  commentId: string;
  body: string;
  score: number;
  correct: boolean;
};

export type PuzzleSubmitSuccess = {
  status: 'submitted';
  score: number;
  slots: PuzzleRevealSlot[];
  userHiveIQ: UserActiveSubredditMetrics | null;
  nextRankIndex: number;
  /** Updated wallet balance after earning coins; null for guests. */
  coins: number | null;
};

export type PuzzleSubmitErrorCode =
  | 'ATTEMPT_EXPIRED'
  | 'ATTEMPT_ALREADY_SUBMITTED'
  | 'INVALID_SLOT_PERMUTATION'
  | 'INVALID_SELECTED_COMMENT'
  | 'HOST_SUBREDDIT_LOCKED'
  | 'WRONG_USER'
  | 'SNAPSHOT_MISSING'
  | 'STALE_PROGRESS';

export type PuzzleSubmitError = {
  status: 'error';
  code: PuzzleSubmitErrorCode;
  message: string;
  nextAction: 'request_next_puzzle' | 'resubmit_valid_slots' | 'refresh_game';
  currentRankIndex?: number;
};

export type PuzzleSubmitResponse = PuzzleSubmitSuccess | PuzzleSubmitError;

export type PuzzleSkipRequest = {
  attemptId: string;
};

export type PuzzleSkipSuccess = {
  status: 'skipped';
  score: 0;
  slots: PuzzleRevealSlot[];
  userHiveIQ: null;
  nextRankIndex: number;
  /** Updated wallet balance after the skip cost; null for guests. */
  coins: number | null;
};

export type PuzzleRevealResult = PuzzleSubmitSuccess | PuzzleSkipSuccess;

export type PuzzleSkipErrorCode =
  | Exclude<PuzzleSubmitErrorCode, 'INVALID_SLOT_PERMUTATION' | 'INVALID_SELECTED_COMMENT'>
  | 'INSUFFICIENT_COINS';

export type PuzzleSkipError = {
  status: 'error';
  code: PuzzleSkipErrorCode;
  message: string;
  nextAction: PuzzleSubmitError['nextAction'];
  currentRankIndex?: number;
};

export type PuzzleSkipResponse = PuzzleSkipSuccess | PuzzleSkipError;

export const MAX_REDDIT_CALLS = 12;
export const MAX_ITEMS_CHECKED = 20;
export const SOFT_DEADLINE_MS = 4500;

export type NextWorkBudget = {
  redditCallsRemaining: number;
  softDeadlineAt: number;
  itemsCheckedRemaining: number;
};
