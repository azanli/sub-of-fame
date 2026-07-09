import { describe, expect, it } from 'vitest';
import { Comment } from '@devvit/reddit/models/Comment.js';
import {
  computeAdaptiveMaxCommentLength,
  computeThreadDensityBaseline,
  isMeasurableBody,
  median,
} from './threadDensity.js';
import { normalizeBody } from './commentValidation.js';

const baseCommentData = {
  author: 'testuser',
  subreddit: 'gaming',
  subredditId: 't5_gaming',
  linkId: 't3_abc123',
  parentId: 't3_abc123',
  permalink: '/r/gaming/comments/abc123/title/comment/xyz/',
  createdUtc: 1_700_000_000,
};

const makeComment = (body: string): Comment =>
  new Comment({
    ...baseCommentData,
    id: 'comment1',
    body,
    score: 100,
  });

describe('median', () => {
  it('returns the fallback baseline for an empty array', () => {
    expect(median([])).toBe(100);
  });

  it('returns the middle value for an odd count', () => {
    expect(median([10, 30, 20])).toBe(20);
  });

  it('averages the two middle values for an even count', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
});

describe('isMeasurableBody', () => {
  it('rejects empty and deleted or removed sentinels', () => {
    expect(isMeasurableBody('')).toBe(false);
    expect(isMeasurableBody('[deleted]')).toBe(false);
    expect(isMeasurableBody('[REMOVED]')).toBe(false);
  });

  it('accepts ordinary text', () => {
    expect(isMeasurableBody('hello world')).toBe(true);
  });
});

describe('computeThreadDensityBaseline', () => {
  it('computes the median normalized length across the pool', () => {
    const pool = [
      makeComment('short one here'),
      makeComment('a'.repeat(60)),
      makeComment('a'.repeat(80)),
      makeComment('a'.repeat(100)),
    ];

    expect(computeThreadDensityBaseline(pool, normalizeBody)).toBe(70);
  });

  it('includes comments that would fail eligibility filters', () => {
    const pool = [
      makeComment('a'.repeat(50)),
      new Comment({
        ...baseCommentData,
        id: 'automod',
        body: 'a'.repeat(70),
        score: 90,
        author: 'AutoModerator',
      }),
    ];

    expect(computeThreadDensityBaseline(pool, normalizeBody)).toBe(60);
  });

  it('falls back to the default baseline when no bodies are measurable', () => {
    const pool = [makeComment('[deleted]'), makeComment('   ')];

    expect(computeThreadDensityBaseline(pool, normalizeBody)).toBe(100);
  });
});

describe('computeAdaptiveMaxCommentLength', () => {
  it('returns the floor at or below the low anchor', () => {
    expect(computeAdaptiveMaxCommentLength(60)).toBe(500);
    expect(computeAdaptiveMaxCommentLength(100)).toBe(500);
  });

  it('returns the ceiling at or above the high anchor', () => {
    expect(computeAdaptiveMaxCommentLength(400)).toBe(1200);
    expect(computeAdaptiveMaxCommentLength(900)).toBe(1200);
  });

  it('linearly interpolates between anchors', () => {
    expect(computeAdaptiveMaxCommentLength(200)).toBe(733);
  });
});
