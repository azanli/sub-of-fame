/** Reddit hosts video and audio as separate DASH streams; the fallback MP4 is video-only. */
export const getRedditVideoAudioUrl = (videoUrl: string): string | undefined => {
  if (!videoUrl.includes('v.redd.it')) {
    return undefined;
  }

  if (/\/CMAF_\d+/.test(videoUrl)) {
    return videoUrl.replace(/\/CMAF_\d+/, '/CMAF_AUDIO_64');
  }

  if (/\/DASH_\d+/.test(videoUrl)) {
    return videoUrl.replace(/\/DASH_\d+/, '/DASH_audio');
  }

  return undefined;
};
