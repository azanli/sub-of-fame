import { PostGallery } from './PostGallery';
import type { ReadyPuzzle } from './types';

type PuzzlePostProps = {
  post: ReadyPuzzle['post'];
};

export const PuzzlePost = ({ post }: PuzzlePostProps) => {
  const galleryUrls =
    post.galleryUrls !== undefined && post.galleryUrls.length > 1
      ? post.galleryUrls
      : undefined;
  const singleImageUrl =
    galleryUrls === undefined ? (post.galleryUrls?.[0] ?? post.imageUrl) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <h2
        onContextMenu={(e) => e.preventDefault()}
        className="text-lg font-semibold text-gray-900 dark:text-white leading-snug"
      >
        {post.title}
      </h2>
      {post.body && (
        <p
          onContextMenu={(e) => e.preventDefault()}
          className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
        >
          {post.body}
        </p>
      )}
      {galleryUrls !== undefined ? (
        <PostGallery imageUrls={galleryUrls} />
      ) : (
        singleImageUrl && (
          <img
            src={singleImageUrl}
            alt="Post context"
            onContextMenu={(e) => e.preventDefault()}
            className="block w-full h-auto rounded-lg"
          />
        )
      )}
    </div>
  );
};
