import type { CampaignTimeframe } from './campaignTimeframes.js';
import type { HiveIQDisplayState } from './hiveIQ.js';
import type { PostContentBlock } from './postContent.js';

export type { CampaignTimeframe } from './campaignTimeframes.js';
export {
  CAMPAIGN_TIMEFRAMES,
  DEFAULT_CAMPAIGN_TIMEFRAME,
  type CampaignContext,
} from './campaignContext.js';

export type GameMode = 'casual' | 'expert';

export const DEFAULT_GAME_MODE: GameMode = 'casual';

export const GAME_MODE_STORAGE_KEY = 'suboffame:gameMode';

export const GAME_MODE_OPTIONS = [
  {
    mode: 'casual' as const,
    label: 'Casual Mode 🚀',
    description:
      'Pick the top comment with the most upvotes. Quick 1-tap intuition.',
  },
  {
    mode: 'expert' as const,
    label: 'Expert Mode 🧠',
    description: 'Rank the top three comments in order of their upvote counts.',
  },
] as const;

export type SetGameModeRequest = {
  gameMode: GameMode;
};

export type SetGameModeResponse = {
  gameMode: GameMode;
};

export type DeleteUserDataRequest = {
  confirmation: 'Delete';
};

export type DeleteUserDataResponse = {
  deleted: true;
};

/** Karma Coins earned for a marginal win (near-miss) without using a hint. */
export const MARGINAL_ROUND_COIN_AWARD = 1;

/** Coin awards by true rank index (0 = #1, 1 = #2, 2 = #3) for casual mode. */
export const CASUAL_COIN_AWARDS = [3, MARGINAL_ROUND_COIN_AWARD, 0] as const;

/** Reveal-tier scores by true rank index for casual mode (near-miss #2 stays 1). */
export const CASUAL_REVEAL_SCORES = [3, 1, 0] as const;

/** Coin award for a perfect round in either game mode. */
export const PERFECT_ROUND_COIN_AWARD = 3;

export type CasualRevealScore = 0 | 1 | 3;

export type RoundStatsDelta = {
  /** Hive IQ correct-slot counter; expert 0–3, casual 1 on perfect #1 pick else 0. */
  correctSlots: number;
  /** Karma Coins earned this round; expert is 0, 1 (one correct slot), or 3 (top-two correct); casual uses CASUAL_COIN_AWARDS. */
  coinAward: number;
};

export type PerformanceCounters = {
  correctSlots: number;
  totalSlots: number;
};

export type SubredditStatsProfile = {
  /** Rolled up across all timeframe campaigns in this subreddit. */
  aggregate: PerformanceCounters;
  byTimeframe: Partial<Record<CampaignTimeframe, PerformanceCounters>>;
  /** Active consecutive wins for this subreddit; defaults to 0. */
  currentStreak: number;
  /** All-time best consecutive wins for this subreddit; defaults to 0. */
  highestStreak: number;
};

export type UserStatsProfile = {
  global: PerformanceCounters;
  bySubreddit: Record<string, SubredditStatsProfile>;
  coins: number;
};

export type UserGlobalHiveIQMetrics = {
  userGlobalHiveIQ: number | null; // Hive IQ score; null when global:total = 0
  totalCorrectSlots: number;
  totalSlots: number;
};

export type CampaignMetrics = {
  timeframe: CampaignTimeframe;
  currentRankIndex: number;
  userCampaignHiveIQ: number | null;
  completedRoundCount: number;
  leaderboardRank: number | null;
};

export type UserActiveSubredditMetrics = {
  /** Subreddit rollup Hive IQ across all campaigns. */
  userSubredditHiveIQ: number | null;
  currentRankIndex: number;
  activeTimeframe: CampaignTimeframe;
};

export type SubredditDisplayMetadata = {
  subreddit: string;
  displayName: string;
  iconUrl: string;
  /** True when Reddit marks the community as NSFW (`SubredditInfo.isNsfw`). */
  isNsfw: boolean;
  metadataSource: 'curated' | 'reddit';
};

export type SubredditDashboardCard = SubredditDisplayMetadata & {
  currentRankIndex: number;
  userSubredditHiveIQ: number | null;
  completedRoundCount: number;
  leaderboardRank: number | null;
  /** Active consecutive wins for this subreddit; defaults to 0. */
  currentStreak: number;
  /** All-time best consecutive wins for this subreddit; defaults to 0. */
  highestStreak: number;
};

export type LeaderboardScope =
  | { kind: 'ecosystem' }
  | { kind: 'subreddit'; subredditName: string };

export type LeaderboardRow = {
  displayRank: number;
  username: string;
  hiveIQDisplay: HiveIQDisplayState;
  highestStreak: number;
  isCurrentUser: boolean;
};

export type LeaderboardSection = {
  scope: LeaderboardScope;
  title: string;
  subredditMetadata: SubredditDisplayMetadata | null;
  entries: LeaderboardRow[];
};

export type LeaderboardPageRequest = Record<string, never>;

export type LeaderboardPageResponse = {
  isHub: boolean;
  sections: LeaderboardSection[];
};

export type LeaderboardEntry = {
  userId: string;
  username: string;
  bestClearedRankIndex: number;
  userSubredditHiveIQ: number;
  completedRoundCount: number;
  highestStreak: number;
  displayRank: number;
  isCurrentUser: boolean;
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
  /** Community host only: one entry per selectable campaign. */
  campaignMetrics: CampaignMetrics[] | null;
  dailyChallenge: DailyChallengeMetrics | null;
};

export type SessionSubRequest = {
  subreddit: string;
  timeframe?: CampaignTimeframe;
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
  timeframe: CampaignTimeframe;
  rankIndex?: number;
  /** Guest-only hint; logged-in users always use server-stored preference. */
  gameMode?: GameMode;
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
        linkUrl?: string;
        linkDomain?: string;
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
        | 'HOST_SUBREDDIT_LOCKED'
        | 'TIMEFRAME_REQUIRED';
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
  /** Reveal-tier score for remarks and slot highlights; not always equal to coins earned. */
  score: number;
  /** Karma Coins earned this round before wallet balance update. */
  coinAward: number;
  /** Whether the player purchased a hint during this attempt. */
  hintUsed: boolean;
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

export type PuzzleForfeitRequest = {
  attemptId: string;
};

export type PuzzleForfeitSuccess = {
  status: 'forfeited';
  score: 0;
  slots: PuzzleRevealSlot[];
  userHiveIQ: UserActiveSubredditMetrics | null;
  nextRankIndex: number;
  /** Updated wallet balance; null for guests. */
  coins: number | null;
};

export type PuzzleRevealResult =
  | PuzzleSubmitSuccess
  | PuzzleSkipSuccess
  | PuzzleForfeitSuccess;

export type PuzzleForfeitErrorCode =
  | Exclude<
      PuzzleSubmitErrorCode,
      'INVALID_SLOT_PERMUTATION' | 'INVALID_SELECTED_COMMENT'
    >
  | 'EXPERT_MODE_FORFEIT_NOT_ALLOWED';

export type PuzzleForfeitError = {
  status: 'error';
  code: PuzzleForfeitErrorCode;
  message: string;
  nextAction: PuzzleSubmitError['nextAction'];
  currentRankIndex?: number;
};

export type PuzzleForfeitResponse = PuzzleForfeitSuccess | PuzzleForfeitError;

export type PuzzleSkipErrorCode =
  | Exclude<
      PuzzleSubmitErrorCode,
      'INVALID_SLOT_PERMUTATION' | 'INVALID_SELECTED_COMMENT'
    >
  | 'INSUFFICIENT_COINS';

export type PuzzleSkipError = {
  status: 'error';
  code: PuzzleSkipErrorCode;
  message: string;
  nextAction: PuzzleSubmitError['nextAction'];
  currentRankIndex?: number;
};

export type PuzzleSkipResponse = PuzzleSkipSuccess | PuzzleSkipError;

export type PuzzleHintRequest = {
  attemptId: string;
};

export type PuzzleHintSuccess = {
  status: 'hinted';
  /** The third-most-upvoted comment ID for this puzzle. */
  commentId: string;
  /** Updated wallet balance after the hint cost; null for guests. */
  coins: number | null;
};

export type PuzzleHintErrorCode =
  | Exclude<
      PuzzleSubmitErrorCode,
      'INVALID_SLOT_PERMUTATION' | 'INVALID_SELECTED_COMMENT'
    >
  | 'INSUFFICIENT_COINS';

export type PuzzleHintError = {
  status: 'error';
  code: PuzzleHintErrorCode;
  message: string;
  nextAction: PuzzleSubmitError['nextAction'];
  currentRankIndex?: number;
};

export type PuzzleHintResponse = PuzzleHintSuccess | PuzzleHintError;

export const MAX_REDDIT_CALLS = 12;
export const MAX_ITEMS_CHECKED = 20;
export const SOFT_DEADLINE_MS = 4500;

export type NextWorkBudget = {
  redditCallsRemaining: number;
  softDeadlineAt: number;
  itemsCheckedRemaining: number;
};
