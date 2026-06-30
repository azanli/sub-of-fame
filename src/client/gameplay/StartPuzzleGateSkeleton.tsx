import { formatSubredditLabel } from '../../shared/subreddits';

type StartPuzzleGateSkeletonProps = {
  subredditDisplayName: string;
  onExit: () => void;
};

const SkeletonBar = ({ className }: { className: string }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`}
  />
);

export const StartPuzzleGateSkeleton = ({
  subredditDisplayName,
  onExit,
}: StartPuzzleGateSkeletonProps) => (
  <>
    <div className="flex flex-col gap-6 p-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            aria-label="Back to dashboard"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
          >
            <span
              aria-hidden="true"
              className="text-md leading-none text-gray-500 dark:text-gray-400"
            >
              ×
            </span>
          </button>
          {subredditDisplayName.length > 0 ? (
            <p className="ml-2 truncate text-sm font-medium tracking-widest text-gray-500 dark:text-gray-400">
              {formatSubredditLabel(subredditDisplayName)}
            </p>
          ) : (
            <SkeletonBar className="ml-2 h-4 w-24" />
          )}
        </div>
        <SkeletonBar className="h-4 w-20" />
      </div>

      <div
        className="flex flex-col gap-3"
        aria-busy="true"
        aria-label="Loading post"
      >
        <SkeletonBar className="h-6 w-full" />
        <SkeletonBar className="h-6 w-4/5" />
        <SkeletonBar className="mt-2 h-48 w-full rounded-lg" />
      </div>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center border-t border-gray-200 bg-gray-50/95 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
      <SkeletonBar className="h-12 w-40 rounded-full" />
    </div>
  </>
);
