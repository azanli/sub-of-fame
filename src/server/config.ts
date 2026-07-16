/**
 * Subreddits that act as the hub surface (show dashboard instead of direct gameplay).
 * In production this is only "suboffame". The dev subreddit is included in the default
 * so that `devvit playtest` on r/sub_of_fame_dev shows the hub dashboard without
 * additional environment configuration.
 *
 * Override at runtime via the HUB_SUBREDDITS env var (comma-separated):
 *   HUB_SUBREDDITS=suboffame,sub_of_fame_dev devvit playtest
 */
const rawHubSubreddits =
  process.env['HUB_SUBREDDITS'] ?? 'suboffame,sub_of_fame_dev';

export const HUB_SUBREDDITS: ReadonlySet<string> = new Set(
  rawHubSubreddits
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
);

/**
 * Dev-only host subreddit spoof for community-lock testing.
 * When non-null, tRPC context pretends the game launched from this subreddit on a community post.
 * Set to null before shipping or when testing normal hub behavior.
 */
export const DEV_SPOOF_HOST_SUBREDDIT: string | null = null; //'funny';

/** Playtest host where dev-only tooling (e.g. rank reset) is permitted. */
export const DEV_PLAYTEST_HOST_SUBREDDIT = 'suboffame';

export const isDevPlaytestHost = (subredditName: string): boolean =>
  subredditName.toLowerCase() === DEV_PLAYTEST_HOST_SUBREDDIT;

/** Adaptive max comment length floor for low-density threads. */
export const ADAPTIVE_MAX_COMMENT_FLOOR = 500;

/** Adaptive max comment length ceiling for high-density threads (UI-safe bound). */
export const ADAPTIVE_MAX_COMMENT_CEILING = 1200;

/** Thread density baseline at or below which the floor max applies. */
export const DENSITY_BASELINE_FOR_FLOOR = 100;

/** Thread density baseline at or above which the ceiling max applies. */
export const DENSITY_BASELINE_FOR_CEILING = 400;

/** Minimum upvote score for the raw Reddit #1 root comment before content filters. */
export const MIN_TOP_COMMENT_SCORE = 50;
