import { navigateTo } from '@devvit/web/client';
import { useEffect, useRef, useState } from 'react';
import { getRedditVideoAudioUrl } from '../../shared/redditVideo';
import { PostGallery } from './PostGallery';
import type { ReadyPuzzle } from './types';

type PuzzlePostProps = {
  post: ReadyPuzzle['post'];
};

const ExternalLinkIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

type PostImageProps = {
  url: string;
  alt: string;
  linkUrl?: string;
  linkDomain?: string;
};

const PostImage = ({ url, alt, linkUrl, linkDomain }: PostImageProps) => {
  const image = (
    <img
      src={url}
      alt={alt}
      onContextMenu={(e) => e.preventDefault()}
      className={`block w-full h-auto ${linkUrl === undefined ? 'rounded-lg' : ''}`}
    />
  );

  if (linkUrl === undefined) {
    return image;
  }

  return (
    <div className="min-h-[75px] relative overflow-hidden rounded-lg">
      {image}
      <div className="absolute bottom-0 flex w-full items-center justify-between gap-3 bg-black/70 p-3 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 text-sm text-white">
          <ExternalLinkIcon />
          {linkDomain !== undefined ? (
            <span className="truncate">{linkDomain}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => navigateTo(linkUrl)}
          className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer"
        >
          Open Link
        </button>
      </div>
    </div>
  );
};

const PostVideo = ({ url }: { url: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrl = getRedditVideoAudioUrl(url);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) {
      return;
    }

    video.muted = true;
  }, [url]);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || audioUrl === undefined) {
      return;
    }

    const syncAudioToVideo = () => {
      const audio = audioRef.current;
      if (audio === null) {
        return;
      }

      audio.volume = video.volume;
      audio.currentTime = video.currentTime;
      if (!video.paused) {
        void audio.play();
      }
    };

    const stopAudio = () => {
      const audio = audioRef.current;
      if (audio !== null) {
        audio.pause();
      }
    };

    const onVolumeChange = () => {
      if (video.muted) {
        stopAudio();
        return;
      }

      setAudioEnabled(true);
    };

    const onPlay = () => {
      if (!video.muted && audioRef.current !== null) {
        syncAudioToVideo();
      }
    };

    const onPause = stopAudio;

    const onSeeked = () => {
      if (!video.muted && !video.paused) {
        syncAudioToVideo();
      }
    };

    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!audioEnabled) {
      return;
    }

    const video = videoRef.current;
    const audio = audioRef.current;
    if (video === null || audio === null || video.muted) {
      return;
    }

    audio.volume = video.volume;
    audio.currentTime = video.currentTime;
    if (!video.paused) {
      void audio.play();
    }
  }, [audioEnabled]);

  return (
    <>
      <video
        ref={videoRef}
        src={url}
        controls
        autoPlay
        loop
        playsInline
        onContextMenu={(e) => e.preventDefault()}
        className="block w-full h-auto max-w-full max-h-full rounded-lg"
      />
      {audioEnabled && audioUrl !== undefined ? (
        <audio ref={audioRef} src={audioUrl} preload="auto" />
      ) : null}
    </>
  );
};

export const PuzzlePost = ({ post }: PuzzlePostProps) => {
  const contentBlocks =
    post.contentBlocks !== undefined && post.contentBlocks.length > 0
      ? post.contentBlocks
      : undefined;
  const galleryUrls =
    post.galleryUrls !== undefined && post.galleryUrls.length > 1
      ? post.galleryUrls
      : undefined;
  const singleImageUrl =
    galleryUrls === undefined
      ? (post.galleryUrls?.[0] ?? post.imageUrl)
      : undefined;
  const showTrailingGallery =
    galleryUrls !== undefined &&
    (contentBlocks === undefined ||
      !contentBlocks.some((block) => block.kind === 'image'));
  const showTrailingSingleImage =
    singleImageUrl !== undefined &&
    !showTrailingGallery &&
    (contentBlocks === undefined ||
      !contentBlocks.some((block) => block.kind === 'image'));

  return (
    <div className="flex flex-col gap-3">
      <h2
        onContextMenu={(e) => e.preventDefault()}
        className="text-lg font-semibold text-gray-900 dark:text-white leading-snug"
      >
        {post.title}
      </h2>
      {contentBlocks !== undefined
        ? contentBlocks.map((block, index) =>
            block.kind === 'text' ? (
              <p
                key={`text-${index}`}
                onContextMenu={(e) => e.preventDefault()}
                className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
              >
                {block.text}
              </p>
            ) : (
              <PostImage
                key={`image-${block.url}-${index}`}
                url={block.url}
                alt="Post context"
              />
            )
          )
        : post.body && (
            <p
              onContextMenu={(e) => e.preventDefault()}
              className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
            >
              {post.body}
            </p>
          )}
      {showTrailingGallery ? (
        <PostGallery imageUrls={galleryUrls} />
      ) : (
        showTrailingSingleImage &&
        (post.isVideo ? (
          <PostVideo key={singleImageUrl} url={singleImageUrl} />
        ) : (
          <PostImage
            url={singleImageUrl}
            alt="Post context"
            {...(post.linkUrl !== undefined ? { linkUrl: post.linkUrl } : {})}
            {...(post.linkDomain !== undefined
              ? { linkDomain: post.linkDomain }
              : {})}
          />
        ))
      )}
    </div>
  );
};
