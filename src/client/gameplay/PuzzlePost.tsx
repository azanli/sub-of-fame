import { PostGallery } from './PostGallery';
import type { ReadyPuzzle } from './types';

type PuzzlePostProps = {
  post: ReadyPuzzle['post'];
};

const PostImage = ({ url, alt }: { url: string; alt: string }) => (
  <img
    src={url}
    alt={alt}
    onContextMenu={(e) => e.preventDefault()}
    className="block w-full h-auto rounded-lg"
  />
);

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
        showTrailingSingleImage && (
          <PostImage url={singleImageUrl} alt="Post context" />
        )
      )}
    </div>
  );
};
