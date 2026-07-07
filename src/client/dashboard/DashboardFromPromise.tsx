import { use } from 'react';
import type { GameMode, InitResponse } from '../../shared/api';
import type { CampaignTimeframe } from '../../shared/campaignTimeframes';
import { HubDashboardFromPromise } from './HubDashboardFromPromise';
import { SubredditDashboardFromPromise } from './SubredditDashboardFromPromise';

type DashboardFromPromiseProps = {
  initPromise: Promise<InitResponse>;
  onSelectSubreddit: (subreddit: string) => void;
  onSelectCampaign: (timeframe: CampaignTimeframe) => void;
  selectionError: string | null;
  loadingSubreddit?: string | null;
  loadingTimeframe?: CampaignTimeframe | null;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
};

export const DashboardFromPromise = ({
  initPromise,
  onSelectSubreddit,
  onSelectCampaign,
  selectionError,
  loadingSubreddit = null,
  loadingTimeframe = null,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
}: DashboardFromPromiseProps) => {
  const initData = use(initPromise);

  if (initData.isHub) {
    return (
      <HubDashboardFromPromise
        initPromise={Promise.resolve(initData)}
        onSelectSubreddit={onSelectSubreddit}
        selectionError={selectionError}
        loadingSubreddit={loadingSubreddit}
        gameMode={gameMode}
        onGameModeChange={onGameModeChange}
        isSavingGameMode={isSavingGameMode}
        gameModeError={gameModeError}
      />
    );
  }

  return (
    <SubredditDashboardFromPromise
      initPromise={Promise.resolve(initData)}
      onSelectCampaign={onSelectCampaign}
      loadingTimeframe={loadingTimeframe}
      gameMode={gameMode}
      onGameModeChange={onGameModeChange}
      isSavingGameMode={isSavingGameMode}
      gameModeError={gameModeError}
    />
  );
};
