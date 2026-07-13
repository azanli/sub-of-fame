import { DashboardSpaceScene } from './DashboardSpaceScene';

const SkeletonBar = ({ className }: { className: string }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`}
  />
);

const DashboardCardSkeleton = () => (
  <div
    aria-hidden="true"
    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
  >
    <SkeletonBar className="h-10 w-10 shrink-0 rounded-full" />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <SkeletonBar className="h-4 w-28" />
      <SkeletonBar className="h-3 w-20" />
    </div>
  </div>
);

export const HubDashboardSkeleton = () => (
  <div
    className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4"
    aria-busy="true"
    aria-label="Loading dashboard"
  >
    <div className="flex items-center w-full mb-4">
      <SkeletonBar className="h-9 w-24 rounded-full" />
      <div className="ml-auto flex items-center gap-3">
        <SkeletonBar className="h-9 w-36 rounded-full" />
        <SkeletonBar className="h-9 w-9 rounded-full" />
      </div>
    </div>

    <DashboardSpaceScene isLoadingSelection={false} isSkeleton={true} />

    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Daily Challenge
      </p>
      <div className="flex flex-col gap-2 pr-1">
        <DashboardCardSkeleton />
      </div>
    </div>

    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Campaigns
      </p>
      <div className="flex flex-col gap-2 pr-1">
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
      </div>
    </div>

    <div className="flex flex-col gap-2">
      <SkeletonBar className="h-4 w-32" />
      <div className="flex gap-2">
        <SkeletonBar className="h-10 min-w-0 flex-1 rounded-full" />
        <SkeletonBar className="h-10 w-16 shrink-0 rounded-full" />
      </div>
    </div>
  </div>
);
