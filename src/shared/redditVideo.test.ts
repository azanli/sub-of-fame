import { describe, expect, it } from 'vitest';
import { getRedditVideoAudioUrl } from './redditVideo';

describe('getRedditVideoAudioUrl', () => {
  it('derives DASH audio URL from a fallback video URL', () => {
    expect(
      getRedditVideoAudioUrl(
        'https://v.redd.it/abc123/DASH_1080.mp4?source=fallback'
      )
    ).toBe('https://v.redd.it/abc123/DASH_audio.mp4?source=fallback');
  });

  it('derives CMAF audio URL from a fallback video URL', () => {
    expect(
      getRedditVideoAudioUrl(
        'https://v.redd.it/abc123/CMAF_720.mp4?source=fallback'
      )
    ).toBe('https://v.redd.it/abc123/CMAF_AUDIO_64.mp4?source=fallback');
  });

  it('returns undefined for non-reddit video URLs', () => {
    expect(
      getRedditVideoAudioUrl('https://example.com/video.mp4')
    ).toBeUndefined();
  });
});
