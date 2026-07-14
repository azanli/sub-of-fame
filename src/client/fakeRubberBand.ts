const MAX_OFFSET_PX = 96;
/** Base settle duration; scaled up for a slower, more deliberate feel. */
const SETTLE_MIN_MS = 800; // Increased from 480
const SETTLE_MAX_MS = 1200; // Increased from 720

/** * Custom cubic-bezier: A much longer, ultra-smooth deceleration.
 * It starts a bit quicker but spends most of its time gently coasting to a stop.
 */
const SETTLE_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'; // "EaseOutExpo" style

const settleDurationMs = (offsetPx: number): number => {
  const t = Math.min(1, Math.abs(offsetPx) / MAX_OFFSET_PX);
  return Math.round(SETTLE_MIN_MS + (SETTLE_MAX_MS - SETTLE_MIN_MS) * t);
};

const resist = (distance: number): number => {
  if (distance === 0) {
    return 0;
  }

  const sign = distance < 0 ? -1 : 1;
  const magnitude = Math.abs(distance);
  return sign * MAX_OFFSET_PX * (1 - Math.exp(-magnitude / MAX_OFFSET_PX));
};

const isAtTop = (scroller: HTMLElement): boolean => scroller.scrollTop <= 0;

const isAtBottom = (scroller: HTMLElement): boolean =>
  scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;

/**
 * Fakes iOS-style rubber-banding inside a confined scroller so the dark body
 * canvas shows at the edges instead of Reddit's white parent WebView.
 */
export const attachFakeRubberBand = (scroller: HTMLElement): (() => void) => {
  let lastY = 0;
  let pull = 0;
  let tracking = false;

  const paint = () => {
    const offset = resist(pull);
    scroller.style.transform =
      offset === 0 ? '' : `translate3d(0, ${offset}px, 0)`;
  };

  const settle = () => {
    tracking = false;

    if (pull === 0) {
      scroller.style.transition = '';
      scroller.style.transform = '';
      return;
    }

    const currentOffset = resist(pull);
    pull = 0;
    scroller.style.transition = 'none';
    scroller.style.transform = `translate3d(0, ${currentOffset}px, 0)`;

    const onEnd = (event: TransitionEvent) => {
      if (event.propertyName !== 'transform') {
        return;
      }
      scroller.style.transition = '';
      scroller.style.transform = '';
      scroller.removeEventListener('transitionend', onEnd);
    };

    scroller.addEventListener('transitionend', onEnd);

    requestAnimationFrame(() => {
      scroller.style.transition = `transform ${settleDurationMs(currentOffset)}ms ${SETTLE_EASING}`;
      scroller.style.transform = 'translate3d(0, 0, 0)';
    });
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches.item(0);
    if (touch === null || event.touches.length !== 1) {
      return;
    }

    scroller.style.transition = '';
    lastY = touch.clientY;
    pull = 0;
    tracking = true;
    paint();
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!tracking) {
      return;
    }

    const touch = event.touches.item(0);
    if (touch === null) {
      return;
    }

    const dy = touch.clientY - lastY;
    lastY = touch.clientY;

    if (pull !== 0) {
      event.preventDefault();
      const nextPull = pull + dy;
      if ((pull > 0 && nextPull <= 0) || (pull < 0 && nextPull >= 0)) {
        pull = 0;
        paint();
        return;
      }
      pull = nextPull;
      paint();
      return;
    }

    if (dy > 0 && isAtTop(scroller)) {
      event.preventDefault();
      pull += dy;
      paint();
      return;
    }

    if (dy < 0 && isAtBottom(scroller)) {
      event.preventDefault();
      pull += dy;
      paint();
    }
  };

  const onTouchEnd = () => {
    settle();
  };

  scroller.addEventListener('touchstart', onTouchStart, { passive: true });
  scroller.addEventListener('touchmove', onTouchMove, { passive: false });
  scroller.addEventListener('touchend', onTouchEnd, { passive: true });
  scroller.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    scroller.removeEventListener('touchstart', onTouchStart);
    scroller.removeEventListener('touchmove', onTouchMove);
    scroller.removeEventListener('touchend', onTouchEnd);
    scroller.removeEventListener('touchcancel', onTouchEnd);
    scroller.style.transform = '';
    scroller.style.transition = '';
  };
};
