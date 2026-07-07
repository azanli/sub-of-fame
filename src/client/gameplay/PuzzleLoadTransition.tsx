import type { InitResponse } from '../../shared/api';
import type { CampaignTimeframe } from '../../shared/campaignTimeframes';
import { HubDashboard } from '../dashboard/HubDashboard';
import { SubredditDashboard } from '../dashboard/SubredditDashboard';

type PuzzleLoadTransitionProps = {
  fromHubSelection: boolean;
  initData: InitResponse | null;
  loadingSubreddit: string;
  selectionError: string | null;
  loadingTimeframe?: CampaignTimeframe | null;
  onSelectCampaign?: () => void;
};

export const PuzzleLoadTransition = ({
  fromHubSelection,
  initData,
  loadingSubreddit,
  selectionError,
  loadingTimeframe = null,
  onSelectCampaign,
}: PuzzleLoadTransitionProps) => {
  if (initData !== null) {
    if (initData.isHub && fromHubSelection) {
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

    if (!initData.isHub && (fromHubSelection || loadingTimeframe !== null)) {
      return (
        <SubredditDashboard
          initData={initData}
          onSelectCampaign={() => {
            onSelectCampaign?.();
          }}
          loadingTimeframe={loadingTimeframe}
          gameMode={initData.gameMode}
          onGameModeChange={() => undefined}
        />
      );
    }
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
