import type { GameMode } from '../../shared/api';
import { GAME_MODE_OPTIONS } from '../../shared/api';

type GameModeSelectorProps = {
  value: GameMode;
  onChange: (mode: GameMode) => void;
  disabled?: boolean;
};

export const GameModeSelector = ({
  value,
  onChange,
  disabled = false,
}: GameModeSelectorProps) => {
  const activeOption =
    GAME_MODE_OPTIONS.find((option) => option.mode === value) ??
    GAME_MODE_OPTIONS[0];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Gameplay Mode
      </p>

      <div
        role="radiogroup"
        aria-label="Gameplay Mode"
        className="mt-3 flex rounded-full border border-gray-300 p-0.5 dark:border-gray-600"
      >
        {GAME_MODE_OPTIONS.map((option) => {
          const isActive = option.mode === value;

          return (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={
                option.mode === 'casual' ? 'Casual Mode' : 'Expert Mode'
              }
              disabled={disabled}
              onClick={() => {
                onChange(option.mode);
              }}
              className={`min-w-0 flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive
                  ? 'bg-[#d93900] text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50'
              }`}
            >
              {option.mode === 'casual' ? 'Casual' : 'Expert'}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        {GAME_MODE_OPTIONS.map((option) => (
          <p
            key={option.mode}
            className={`text-xs leading-relaxed ${
              option.mode === activeOption.mode
                ? 'text-gray-700 dark:text-gray-200'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="font-medium">{option.label}</span>
            {' — '}
            {option.description}
          </p>
        ))}
      </div>
    </div>
  );
};
