import { useState } from 'react';

type PostGalleryProps = {
  imageUrls: string[];
};

const ChevronLeftIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const PostGallery = ({ imageUrls }: PostGalleryProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const totalImages = imageUrls.length;
  const activeImage = imageUrls[activeIndex];

  if (activeImage === undefined) {
    return null;
  }

  const goToPrevious = () => {
    setActiveIndex((current) =>
      current === 0 ? totalImages - 1 : current - 1
    );
  };

  const goToNext = () => {
    setActiveIndex((current) =>
      current === totalImages - 1 ? 0 : current + 1
    );
  };

  return (
    <div className="relative overflow-hidden rounded-lg bg-black/5 dark:bg-black/30">
      <img
        key={activeImage}
        src={activeImage}
        alt={`Gallery image ${activeIndex + 1} of ${totalImages}`}
        onContextMenu={(e) => e.preventDefault()}
        className="block w-full h-auto"
      />

      <button
        type="button"
        onClick={goToPrevious}
        aria-label="Previous image"
        className="absolute left-2 top-1/2 -translate-y-1/2 p-4 cursor-pointer group"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors group-hover:bg-black/70">
          <ChevronLeftIcon />
        </div>
      </button>
      <button
        type="button"
        onClick={goToNext}
        aria-label="Next image"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-4 cursor-pointer group"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors group-hover:bg-black/70">
          <ChevronRightIcon />
        </div>
      </button>

      <div
        aria-live="polite"
        className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white"
      >
        {activeIndex + 1} / {totalImages}
      </div>
    </div>
  );
};
