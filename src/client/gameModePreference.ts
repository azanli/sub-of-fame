import {
  DEFAULT_GAME_MODE,
  GAME_MODE_STORAGE_KEY,
  type GameMode,
  type InitResponse,
} from '../shared/api';

const isGameMode = (value: string): value is GameMode =>
  value === 'casual' || value === 'expert';

export const readLocalGameMode = (): GameMode | null => {
  try {
    const stored = localStorage.getItem(GAME_MODE_STORAGE_KEY);
    if (stored === null || !isGameMode(stored)) {
      return null;
    }
    return stored;
  } catch {
    return null;
  }
};

export const writeLocalGameMode = (mode: GameMode): void => {
  try {
    localStorage.setItem(GAME_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures in restricted iframe contexts.
  }
};

export const mergeInitGameMode = (init: InitResponse): InitResponse => {
  if (init.userGlobalHiveIQ !== null) {
    return init;
  }

  const localMode = readLocalGameMode();
  if (localMode === null) {
    return init;
  }

  return {
    ...init,
    gameMode: localMode,
  };
};

export const resolveGuestGameMode = (): GameMode =>
  readLocalGameMode() ?? DEFAULT_GAME_MODE;
