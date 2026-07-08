import { use } from 'react';
import type { GameMode, InitResponse } from '../../shared/api';
import type { CampaignTimeframe } from '../../shared/campaignTimeframes';
import { SubredditDashboard } from './SubredditDashboard';

type SubredditDashboardFromPromiseProps = {
  initPromise: Promise<InitResponse>;
  onSelectCampaign: (timeframe: CampaignTimeframe) => void;
  loadingTimeframe?: CampaignTimeframe | null;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
};

const noopDeleteUserData = async (): Promise<void> => {};

export const SubredditDashboardFromPromise = ({
  initPromise,
  onSelectCampaign,
  loadingTimeframe = null,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
}: SubredditDashboardFromPromiseProps) => {
  const initData = use(initPromise);

  return (
    <SubredditDashboard
      initData={{ ...initData, gameMode }}
      onSelectCampaign={onSelectCampaign}
      loadingTimeframe={loadingTimeframe}
      gameMode={gameMode}
      onGameModeChange={onGameModeChange}
      isSavingGameMode={isSavingGameMode}
      gameModeError={gameModeError}
      onDeleteUserData={noopDeleteUserData}
    />
  );
};
