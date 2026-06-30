import type { InitResponse } from '../../shared/api';
import { HubDashboard } from '../dashboard/HubDashboard';

type PuzzleLoadTransitionProps = {
  fromHubSelection: boolean;
  initData: InitResponse | null;
  loadingSubreddit: string;
  selectionError: string | null;
};

export const PuzzleLoadTransition = ({
  fromHubSelection,
  initData,
  loadingSubreddit,
  selectionError,
}: PuzzleLoadTransitionProps) => {
  if (fromHubSelection && initData !== null) {
    return (
      <HubDashboard
        initData={initData}
        loadingSubreddit={loadingSubreddit}
        onSelectSubreddit={() => undefined}
        selectionError={selectionError}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"
        aria-busy="true"
        aria-label="Loading puzzle"
      />
    </div>
  );
};
