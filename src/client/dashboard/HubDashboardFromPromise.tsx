import { use } from 'react';
import type { GameMode, InitResponse } from '../../shared/api';
import { HubDashboard } from './HubDashboard';

type HubDashboardFromPromiseProps = {
  initPromise: Promise<InitResponse>;
  onSelectSubreddit: (subreddit: string) => void;
  selectionError: string | null;
  loadingSubreddit?: string | null;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
};

const noopDeleteUserData = async (): Promise<void> => {};

export const HubDashboardFromPromise = ({
  initPromise,
  onSelectSubreddit,
  selectionError,
  loadingSubreddit = null,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
}: HubDashboardFromPromiseProps) => {
  const initData = use(initPromise);

  return (
    <HubDashboard
      initData={{ ...initData, gameMode }}
      onSelectSubreddit={onSelectSubreddit}
      selectionError={selectionError}
      loadingSubreddit={loadingSubreddit}
      gameMode={gameMode}
      onGameModeChange={onGameModeChange}
      isSavingGameMode={isSavingGameMode}
      gameModeError={gameModeError}
      onDeleteUserData={noopDeleteUserData}
    />
  );
};
