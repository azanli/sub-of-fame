import type { GameMode } from '../../shared/api';
import { DeleteUserDataSection } from './DeleteUserDataSection';
import { FaqSection, type FaqVariant } from './FaqSection';
import { GameModeSelector } from './GameModeSelector';
import { HowToPlaySection } from './HowToPlaySection';

type HubSettingsPanelProps = {
  id: string;
  faqVariant: FaqVariant;
  isOpen: boolean;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
  isLoggedIn: boolean;
  onDeleteUserData: () => Promise<void>;
  isDeletingUserData?: boolean;
  deleteUserDataError?: string | null;
};

export const HubSettingsPanel = ({
  id,
  faqVariant,
  isOpen,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
  isLoggedIn,
  onDeleteUserData,
  isDeletingUserData = false,
  deleteUserDataError = null,
}: HubSettingsPanelProps) => (
  <div
    id={id}
    aria-hidden={!isOpen}
    className={`grid transition-all duration-300 ease-out ${
      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
    }`}
  >
    <div className="overflow-hidden">
      <div className="flex flex-col gap-3 pb-1 pt-2">
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
        <HowToPlaySection variant={faqVariant} />
        <FaqSection variant={faqVariant} />
        {isLoggedIn ? (
          <DeleteUserDataSection
            onDelete={onDeleteUserData}
            isDeleting={isDeletingUserData}
            error={deleteUserDataError}
          />
        ) : null}
      </div>
    </div>
  </div>
);
