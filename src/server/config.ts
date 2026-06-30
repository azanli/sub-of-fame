/**
 * Subreddits that act as the hub surface (show dashboard instead of direct gameplay).
 * In production this is only "suboffame". The dev subreddit is included in the default
 * so that `devvit playtest` on r/sub_of_fame_dev shows the hub dashboard without
 * additional environment configuration.
 *
 * Override at runtime via the HUB_SUBREDDITS env var (comma-separated):
 *   HUB_SUBREDDITS=suboffame,sub_of_fame_dev devvit playtest
 */
const rawHubSubreddits = process.env['HUB_SUBREDDITS'] ?? 'suboffame,sub_of_fame_dev';

export const HUB_SUBREDDITS: ReadonlySet<string> = new Set(
  rawHubSubreddits
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
);

/** Maximum normalized comment body length for puzzle eligibility (all three comments). */
export const MAX_COMMENT_LENGTH = 180;
