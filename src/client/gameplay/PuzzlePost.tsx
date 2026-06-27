import type { ReadyPuzzle } from './types';

type PuzzlePostProps = {
  post: ReadyPuzzle['post'];
};

export const PuzzlePost = ({ post }: PuzzlePostProps) => (
  <div className="flex flex-col gap-3">
    <h2 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug">
      {post.title}
    </h2>
    {post.body && (
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
        {post.body}
      </p>
    )}
    {post.imageUrl && (
      <img
        src={post.imageUrl}
        alt="Post context"
        className="w-full rounded-lg object-contain max-h-64"
      />
    )}
  </div>
);
