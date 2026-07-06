import { describe, expect, it } from 'vitest';
import {
  formatSubredditLabel,
  normalizeSubredditDisplayName,
} from './subreddits';

describe('normalizeSubredditDisplayName', () => {
  it('strips a leading r/ prefix', () => {
    expect(normalizeSubredditDisplayName('r/DadJokes')).toBe('DadJokes');
  });

  it('strips a leading r/ prefix case-insensitively', () => {
    expect(normalizeSubredditDisplayName('R/AskReddit')).toBe('AskReddit');
  });

  it('trims whitespace', () => {
    expect(normalizeSubredditDisplayName('  DadJokes  ')).toBe('DadJokes');
  });
});

describe('formatSubredditLabel', () => {
  it('adds r/ prefix to a clean display name', () => {
    expect(formatSubredditLabel('DadJokes')).toBe('r/DadJokes');
  });

  it('does not double-prefix when display name already includes r/', () => {
    expect(formatSubredditLabel('r/DadJokes')).toBe('r/DadJokes');
  });
});
