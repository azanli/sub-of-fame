import type { Comment } from '@devvit/reddit';
import {
  ADAPTIVE_MAX_COMMENT_CEILING,
  ADAPTIVE_MAX_COMMENT_FLOOR,
  DENSITY_BASELINE_FOR_CEILING,
  DENSITY_BASELINE_FOR_FLOOR,
} from '../config.js';

/** Fallback baseline when the evaluation pool has no measurable bodies. */
export const DEFAULT_DENSITY_BASELINE = DENSITY_BASELINE_FOR_FLOOR;

export const median = (values: number[]): number => {
  if (values.length === 0) {
    return DEFAULT_DENSITY_BASELINE;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle]!;
  }

  return (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export const isMeasurableBody = (normalizedBody: string): boolean => {
  if (normalizedBody.length === 0) {
    return false;
  }

  const sentinel = normalizedBody.toLowerCase();
  return sentinel !== '[deleted]' && sentinel !== '[removed]';
};

export const computeThreadDensityBaseline = (
  pool: Comment[],
  normalize: (body: string) => string
): number => {
  const lengths = pool
    .map((comment) => normalize(comment.body))
    .filter(isMeasurableBody)
    .map((body) => body.length);

  if (lengths.length === 0) {
    return DEFAULT_DENSITY_BASELINE;
  }

  return median(lengths);
};

export const computeAdaptiveMaxCommentLength = (baseline: number): number => {
  if (baseline <= DENSITY_BASELINE_FOR_FLOOR) {
    return ADAPTIVE_MAX_COMMENT_FLOOR;
  }

  if (baseline >= DENSITY_BASELINE_FOR_CEILING) {
    return ADAPTIVE_MAX_COMMENT_CEILING;
  }

  const span = DENSITY_BASELINE_FOR_CEILING - DENSITY_BASELINE_FOR_FLOOR;
  const t = (baseline - DENSITY_BASELINE_FOR_FLOOR) / span;

  return Math.round(
    ADAPTIVE_MAX_COMMENT_FLOOR +
      t * (ADAPTIVE_MAX_COMMENT_CEILING - ADAPTIVE_MAX_COMMENT_FLOOR)
  );
};
