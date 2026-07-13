import {
  useRef,
  useState,
  type PointerEvent,
  type TransitionEvent,
} from 'react';

type PostGalleryProps = {
  imageUrls: string[];
};

const SWIPE_THRESHOLD_RATIO = 0.2;
const AXIS_LOCK_THRESHOLD_PX = 8;
const SLIDE_TRANSITION_MS = 280;

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
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [suppressTransition, setSuppressTransition] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const axisLockRef = useRef<'x' | 'y' | null>(null);
  const pendingNavRef = useRef<-1 | 0 | 1>(0);

  const totalImages = imageUrls.length;
  const canNavigate = totalImages > 1;
  const activeImage = imageUrls[activeIndex];

  if (activeImage === undefined) {
    return null;
  }

  const prevIndex = (activeIndex - 1 + totalImages) % totalImages;
  const nextIndex = (activeIndex + 1) % totalImages;
  const prevImage = imageUrls[prevIndex] ?? activeImage;
  const nextImage = imageUrls[nextIndex] ?? activeImage;

  const updateDragOffset = (offset: number) => {
    dragOffsetRef.current = offset;
    setDragOffset(offset);
  };

  const settle = (direction: 'prev' | 'next' | 'cancel') => {
    const width = viewportRef.current?.offsetWidth ?? 0;

    if (direction === 'cancel') {
      if (dragOffsetRef.current === 0) {
        setIsAnimating(false);
        return;
      }
      pendingNavRef.current = 0;
      setIsAnimating(true);
      updateDragOffset(0);
      return;
    }

    if (width === 0) {
      setActiveIndex((current) =>
        direction === 'prev'
          ? current === 0
            ? totalImages - 1
            : current - 1
          : current === totalImages - 1
            ? 0
            : current + 1
      );
      updateDragOffset(0);
      setIsAnimating(false);
      return;
    }

    pendingNavRef.current = direction === 'prev' ? -1 : 1;
    setIsAnimating(true);
    updateDragOffset(direction === 'prev' ? width : -width);
  };

  const goToPrevious = () => {
    if (!canNavigate || isAnimating || isDragging) {
      return;
    }
    settle('prev');
  };

  const goToNext = () => {
    if (!canNavigate || isAnimating || isDragging) {
      return;
    }
    settle('next');
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canNavigate || isAnimating || event.button !== 0) {
      return;
    }

    dragStartRef.current = { x: event.clientX, y: event.clientY };
    axisLockRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) {
      return;
    }

    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;

    if (axisLockRef.current === null) {
      if (
        Math.abs(dx) < AXIS_LOCK_THRESHOLD_PX &&
        Math.abs(dy) < AXIS_LOCK_THRESHOLD_PX
      ) {
        return;
      }

      axisLockRef.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      if (axisLockRef.current === 'y') {
        dragStartRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }

      setIsDragging(true);
    }

    if (axisLockRef.current === 'x') {
      updateDragOffset(dx);
    }
  };

  const finishPointerGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) {
      return;
    }

    const lockedAxis = axisLockRef.current;
    dragStartRef.current = null;
    axisLockRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (lockedAxis !== 'x') {
      setIsDragging(false);
      return;
    }

    const width = viewportRef.current?.offsetWidth ?? 1;
    const offset = dragOffsetRef.current;
    const threshold = width * SWIPE_THRESHOLD_RATIO;

    setIsDragging(false);

    if (offset > threshold) {
      settle('prev');
    } else if (offset < -threshold) {
      settle('next');
    } else {
      settle('cancel');
    }
  };

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (
      event.propertyName !== 'transform' ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    const pending = pendingNavRef.current;
    pendingNavRef.current = 0;

    if (pending === -1 || pending === 1) {
      setSuppressTransition(true);
      setActiveIndex((current) =>
        pending === -1
          ? current === 0
            ? totalImages - 1
            : current - 1
          : current === totalImages - 1
            ? 0
            : current + 1
      );
      updateDragOffset(0);
      setIsAnimating(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSuppressTransition(false);
        });
      });
      return;
    }

    setIsAnimating(false);
  };

  const trackTransition =
    suppressTransition || isDragging
      ? 'none'
      : `transform ${SLIDE_TRANSITION_MS}ms ease-out`;

  return (
    <div
      ref={viewportRef}
      className="relative overflow-hidden rounded-lg bg-black/5 dark:bg-black/30"
    >
      <div className="relative">
        <img
          src={activeImage}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none block w-full h-auto opacity-0"
        />
        <div
          className={`absolute inset-0 touch-pan-y ${
            canNavigate ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerGesture}
          onPointerCancel={finishPointerGesture}
        >
          <div
            className="flex h-full w-[300%] select-none"
            style={{
              transform: `translateX(calc(-33.333333% + ${dragOffset}px))`,
              transition: trackTransition,
            }}
            onTransitionEnd={handleTransitionEnd}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="relative h-full w-1/3 shrink-0">
              <img
                src={prevImage}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
            <div className="relative h-full w-1/3 shrink-0">
              <img
                src={activeImage}
                alt={`Gallery image ${activeIndex + 1} of ${totalImages}`}
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
            <div className="relative h-full w-1/3 shrink-0">
              <img
                src={nextImage}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {canNavigate && (
        <>
          <button
            type="button"
            onClick={goToPrevious}
            aria-label="Previous image"
            disabled={isAnimating || isDragging}
            className="absolute left-2 top-9 z-10 -translate-y-1/2 p-4 cursor-pointer group disabled:pointer-events-none"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors group-hover:bg-black/70">
              <ChevronLeftIcon />
            </div>
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next image"
            disabled={isAnimating || isDragging}
            className="absolute right-2 top-9 z-10 -translate-y-1/2 p-4 cursor-pointer group disabled:pointer-events-none"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors group-hover:bg-black/70">
              <ChevronRightIcon />
            </div>
          </button>
        </>
      )}

      <div
        aria-live="polite"
        className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white"
      >
        {activeIndex + 1} / {totalImages}
      </div>
    </div>
  );
};
