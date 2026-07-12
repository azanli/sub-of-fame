import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type ShopTeaserModalProps = {
  open: boolean;
  onClose: () => void;
};

export const ShopTeaserModal = ({ open, onClose }: ShopTeaserModalProps) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-teaser-title"
        className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center gap-2.5">
          <img
            src="/coin.svg"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 shrink-0"
          />
          <h2
            id="shop-teaser-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            The Snoo Exchange
          </h2>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          Our merchants are currently deep-diving into subreddits to curate
          premium, game-enhancing gear. The shelves are currently empty, but a
          restocking wave is hitting the exchange in the next major update!
        </p>

        <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Rest assured, this market exclusively accepts hard-earned coins. No
          real cash required. Keep stacking your balance. You&apos;ll want to be
          ready when the gates open!
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-[#d93900] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c23300] cursor-pointer"
        >
          Back to the Gauntlet
        </button>
      </div>
    </div>,
    document.body
  );
};
