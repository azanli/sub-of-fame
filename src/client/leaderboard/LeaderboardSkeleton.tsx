export const LeaderboardSkeleton = ({ isHub = false }: { isHub: boolean }) => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: isHub ? 3 : 1 }, (_, index) => (
      <div key={index} className="flex flex-col gap-2">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          {Array.from({ length: 5 }, (_, rowIndex) => (
            <div
              key={rowIndex}
              className="flex items-center gap-3 border-b border-gray-200 px-3 py-3 last:border-b-0 dark:border-gray-700"
            >
              <div className="h-4 w-6 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);
