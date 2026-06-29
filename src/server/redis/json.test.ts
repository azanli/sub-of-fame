import { describe, expect, it } from 'vitest';
import { parseJson, stringifyJson } from './json';
import type { PuzzleAttempt, PuzzleSnapshot, LadderCachePage, LadderCursorChain, SubredditMetadataCacheEntry } from './types';

describe('parseJson', () => {
  it('returns null for a null input (key missing)', () => {
    expect(parseJson(null)).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseJson('not-json')).toBeNull();
    expect(parseJson('{')).toBeNull();
    expect(parseJson('"unterminated')).toBeNull();
  });

  it('parses a valid JSON string', () => {
    expect(parseJson<{ x: number }>('{"x":42}')).toEqual({ x: 42 });
  });

  it('round-trips a SubredditMetadataCacheEntry', () => {
    const entry: SubredditMetadataCacheEntry = {
      subreddit: 'askreddit',
      displayName: 'AskReddit',
      iconUrl: 'https://example.com/icon.png',
      fetchedAt: 1000,
      expiresAt: 2000,
    };
    expect(parseJson<SubredditMetadataCacheEntry>(stringifyJson(entry))).toEqual(entry);
  });

  it('round-trips a LadderCachePage', () => {
    const page: LadderCachePage = {
      page: 1,
      startsAfter: null,
      nextAfter: 'cursor_abc',
      posts: [{ id: 't3_1', title: 'Hello', postUrl: 'https://www.reddit.com/r/test/comments/1/hello/', hasBody: false, isNSFW: false, isSpoiler: false, commentCount: 42 }],
      fetchedAt: 1000,
    };
    expect(parseJson<LadderCachePage>(stringifyJson(page))).toEqual(page);
  });

  it('round-trips a LadderCursorChain', () => {
    const chain: LadderCursorChain = {
      subreddit: 'gaming',
      startsAfter: { 1: null, 2: 'cursor_xyz' },
      deepestKnownPage: 2,
      terminalPage: null,
      updatedAt: 9999,
    };
    expect(parseJson<LadderCursorChain>(stringifyJson(chain))).toEqual(chain);
  });

  it('round-trips a PuzzleSnapshot', () => {
    const snap: PuzzleSnapshot = {
      sourcePostId: 't3_abc',
      post: { title: 'Test post' },
      numberOfComments: 25,
      comments: [
        { id: 't1_1', body: 'First', score: 100, createdAt: 1 },
        { id: 't1_2', body: 'Second', score: 50, createdAt: 2 },
        { id: 't1_3', body: 'Third', score: 10, createdAt: 3 },
      ],
      createdAt: 1000,
      expiresAt: 2000,
    };
    expect(parseJson<PuzzleSnapshot>(stringifyJson(snap))).toEqual(snap);
  });

  it('round-trips a PuzzleAttempt', () => {
    const attempt: PuzzleAttempt = {
      attemptId: 'uuid-1',
      sourcePostId: 't3_abc',
      subreddit: 'gaming',
      rankIndex: 3,
      owner: { kind: 'user', userId: 'u999' },
      commentOrder: ['t1_2', 't1_1', 't1_3'],
      submitted: false,
      createdAt: 1000,
      expiresAt: 4600,
    };
    expect(parseJson<PuzzleAttempt>(stringifyJson(attempt))).toEqual(attempt);
  });

  it('round-trips a guest PuzzleAttempt', () => {
    const attempt: PuzzleAttempt = {
      attemptId: 'uuid-2',
      sourcePostId: 't3_def',
      subreddit: 'askreddit',
      rankIndex: 1,
      owner: { kind: 'guest' },
      commentOrder: ['t1_a', 't1_b', 't1_c'],
      submitted: false,
      createdAt: 500,
      expiresAt: 4100,
    };
    expect(parseJson<PuzzleAttempt>(stringifyJson(attempt))).toEqual(attempt);
  });
});

describe('stringifyJson', () => {
  it('serializes primitives', () => {
    expect(stringifyJson(42)).toBe('42');
    expect(stringifyJson('hello')).toBe('"hello"');
    expect(stringifyJson(null)).toBe('null');
  });

  it('throws a RedisStorageError on circular references', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => stringifyJson(circular)).toThrow();
  });
});
