import { useState } from 'react';

type DeleteUserDataSectionProps = {
  onDelete: () => Promise<void>;
  isDeleting?: boolean;
  error?: string | null;
};

export const DeleteUserDataSection = ({
  onDelete,
  isDeleting = false,
  error = null,
}: DeleteUserDataSectionProps) => {
  const [confirmation, setConfirmation] = useState('');
  const isConfirmed = confirmation === 'Delete';

  const handleDelete = () => {
    if (!isConfirmed || isDeleting) {
      return;
    }

    void onDelete().then(() => {
      setConfirmation('');
    });
  };

  return (
    <div className="rounded-xl border border-red-200 bg-white p-4 dark:border-red-900/50 dark:bg-gray-800">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">
        Delete My Data
      </p>

      <p className="mt-2 text-xs leading-relaxed text-red-600 dark:text-red-400">
        <span className="font-semibold">
          This action is permanent and cannot be undone.
        </span>{' '}
        All of your data will be permanently deleted.
      </p>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Type &quot;Delete&quot; to confirm
        </span>
        <input
          type="text"
          value={confirmation}
          disabled={isDeleting}
          onChange={(event) => {
            setConfirmation(event.target.value);
          }}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <button
        type="button"
        disabled={!isConfirmed || isDeleting}
        onClick={handleDelete}
        className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
      >
        {isDeleting ? 'Deleting...' : 'Delete My Data'}
      </button>

      {error !== null ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
};
