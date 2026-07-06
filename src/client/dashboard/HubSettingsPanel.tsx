import type { GameMode } from '../../shared/api';
import { GameModeSelector } from './GameModeSelector';

type HubSettingsPanelProps = {
  id: string;
  isOpen: boolean;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
};

export const HubSettingsPanel = ({
  id,
  isOpen,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
}: HubSettingsPanelProps) => (
  <div
    id={id}
    aria-hidden={!isOpen}
    className={`grid transition-all duration-300 ease-out ${
      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
    }`}
  >
    <div className="overflow-hidden">
      <div className="flex flex-col gap-2 pb-1 pt-2">
        <GameModeSelector
          value={gameMode}
          onChange={onGameModeChange}
          disabled={isSavingGameMode}
        />
        {gameModeError !== null ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {gameModeError}
          </p>
        ) : null}
      </div>
    </div>
  </div>
);
