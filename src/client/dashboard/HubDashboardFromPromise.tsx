import { use } from 'react';
import type { GameMode, InitResponse } from '../../shared/api';
import { HubDashboard } from './HubDashboard';

type HubDashboardFromPromiseProps = {
  initPromise: Promise<InitResponse>;
  onSelectSubreddit: (subreddit: string) => void;
  selectionError: string | null;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
};

export const HubDashboardFromPromise = ({
  initPromise,
  onSelectSubreddit,
  selectionError,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
}: HubDashboardFromPromiseProps) => {
  const initData = use(initPromise);

  if (!initData.isHub) {
    return null;
  }

  return (
    <HubDashboard
      initData={{ ...initData, gameMode }}
      onSelectSubreddit={onSelectSubreddit}
      selectionError={selectionError}
      gameMode={gameMode}
      onGameModeChange={onGameModeChange}
      isSavingGameMode={isSavingGameMode}
      gameModeError={gameModeError}
    />
  );
};
