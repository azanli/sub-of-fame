import { useEffect, useState } from 'react';
import type { RescueAnimationPhase } from '../rescueAnimation';
import { RESCUE_SCENE, RESCUE_SCENE_IMAGES } from '../rescueAnimation';

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type RescuedSnooProps = {
  bottomPercent: number;
  snooScale: number;
  dropFromBottomPercent: number;
  dropFromScale: number;
  phase: RescueAnimationPhase;
};

const fallingSnooSizeClass =
  'h-[clamp(4rem,14vw,6rem)] w-[clamp(4rem,14vw,6rem)]';

const FallingSnooSprite = () => (
  <div className={`relative ${fallingSnooSizeClass}`}>
    <img
      src={RESCUE_SCENE_IMAGES.snooFalling1}
      alt=""
      aria-hidden="true"
      className="rescue-snoo-falling-frame-a absolute inset-0 h-full w-full object-contain"
    />
    <img
      src={RESCUE_SCENE_IMAGES.snooFalling2}
      alt=""
      aria-hidden="true"
      className="rescue-snoo-falling-frame-b absolute inset-0 h-full w-full object-contain"
    />
  </div>
);

const CheerSnoo = () => (
  <img
    src={RESCUE_SCENE_IMAGES.snooPensive}
    alt=""
    aria-hidden="true"
    className="h-[clamp(4rem,14vw,6rem)] w-auto object-contain"
  />
);

export const RescuedSnoo = ({
  bottomPercent,
  snooScale,
  dropFromBottomPercent,
  dropFromScale,
  phase,
}: RescuedSnooProps) => {
  const isExpired = phase === 'expired';
  const [showPanicSprite, setShowPanicSprite] = useState(
    () => phase === 'expired' || (phase === 'panic' && prefersReducedMotion())
  );

  useEffect(() => {
    if (phase === 'expired') {
      setShowPanicSprite(true);
      return;
    }

    if (phase !== 'panic') {
      setShowPanicSprite(false);
      return;
    }

    if (prefersReducedMotion()) {
      setShowPanicSprite(true);
      return;
    }

    let cancelled = false;
    const delayId = window.setTimeout(() => {
      if (!cancelled) {
        setShowPanicSprite(true);
      }
    }, RESCUE_SCENE.panicSnooSpriteDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(delayId);
    };
  }, [phase]);

  const showFallingSprite =
    (phase === 'panic' && showPanicSprite) || phase === 'expired';

  return (
    <div
      aria-hidden="true"
      className={`rescue-snoo absolute left-1/2 z-[2] origin-bottom ${
        isExpired ? 'rescue-snoo-drop-out' : 'rescue-snoo-lift'
      }`}
      style={{
        ...(isExpired
          ? {
              '--snoo-fall-from': `${dropFromBottomPercent}%`,
              '--snoo-fall-to': `${RESCUE_SCENE.snooDropOutPercent}%`,
            }
          : { bottom: `${bottomPercent}%` }),
        transform: `translateX(-50%) scale(${
          isExpired ? dropFromScale : snooScale
        })`,
      }}
    >
      {showFallingSprite ? <FallingSnooSprite /> : <CheerSnoo />}
    </div>
  );
};
