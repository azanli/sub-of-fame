const SkeletonBar = ({ className }: { className: string }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`}
  />
);

const CampaignCardSkeleton = () => (
  <div
    aria-hidden="true"
    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
  >
    <SkeletonBar className="h-10 w-10 shrink-0 rounded-full" />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <SkeletonBar className="h-4 w-36" />
      <SkeletonBar className="h-3 w-48" />
    </div>
  </div>
);

export const SubredditDashboardSkeleton = () => (
  <div
    className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4"
    aria-busy="true"
    aria-label="Loading dashboard"
  >
    <div className="flex items-center">
      <SkeletonBar className="h-8 w-28 rounded-full" />
      <div className="ml-auto flex items-center gap-2">
        <SkeletonBar className="h-8 w-32 rounded-lg" />
        <SkeletonBar className="h-8 w-8 rounded-lg" />
      </div>
    </div>

    <div
      aria-hidden="true"
      className="mt-4 flex items-center justify-between gap-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <SkeletonBar className="h-12 w-12 shrink-0 rounded-full" />
        <SkeletonBar className="h-6 w-28" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <SkeletonBar className="h-4 w-24" />
        <SkeletonBar className="h-4 w-20" />
      </div>
    </div>

    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Campaigns
      </p>
      <div className="flex flex-col gap-2 pr-1">
        <CampaignCardSkeleton />
        <CampaignCardSkeleton />
        <CampaignCardSkeleton />
        <CampaignCardSkeleton />
        <CampaignCardSkeleton />
        <CampaignCardSkeleton />
      </div>
    </div>

    <SkeletonBar className="mx-auto h-32 w-1/2 max-w-[220px] rounded-lg" />
  </div>
);
