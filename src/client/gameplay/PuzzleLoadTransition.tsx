import type { InitResponse } from '../../shared/api';
import { HubDashboard } from '../dashboard/HubDashboard';
import { SubredditDashboard } from '../dashboard/SubredditDashboard';

type PuzzleLoadTransitionProps = {
  fromHubSelection: boolean;
  initData: InitResponse | null;
  loadingSubreddit: string;
  selectionError: string | null;
  onSelectCampaign?: () => void;
};

export const PuzzleLoadTransition = ({
  fromHubSelection,
  initData,
  loadingSubreddit,
  selectionError,
  onSelectCampaign,
}: PuzzleLoadTransitionProps) => {
  if (fromHubSelection && initData !== null) {
    if (initData.isHub) {
      return (
        <HubDashboard
          initData={initData}
          loadingSubreddit={loadingSubreddit}
          onSelectSubreddit={() => undefined}
          selectionError={selectionError}
          gameMode={initData.gameMode}
          onGameModeChange={() => undefined}
        />
      );
    }

    return (
      <SubredditDashboard
        initData={initData}
        onSelectCampaign={() => {
          onSelectCampaign?.();
        }}
        gameMode={initData.gameMode}
        onGameModeChange={() => undefined}
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
