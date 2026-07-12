import { useEffect, useState } from 'react';
import type { RescueAnimationPhase } from '../rescueAnimation';
import {
  pickRescueSnooPose,
  RESCUE_SCENE,
  RESCUE_SCENE_IMAGES,
} from '../rescueAnimation';

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

type CheerSnooProps = {
  src: string;
};

const CheerSnoo = ({ src }: CheerSnooProps) => (
  <img
    src={src}
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
  const [snooPoseSrc] = useState(pickRescueSnooPose);
  const [panicSpriteReady, setPanicSpriteReady] = useState(
    () => phase === 'expired' || (phase === 'panic' && prefersReducedMotion())
  );
  const [prevPhase, setPrevPhase] = useState(phase);

  if (phase !== prevPhase) {
    setPrevPhase(phase);
    setPanicSpriteReady(
      phase === 'expired' || (phase === 'panic' && prefersReducedMotion())
    );
  }

  useEffect(() => {
    if (phase !== 'panic' || prefersReducedMotion()) {
      return;
    }

    let cancelled = false;
    const delayId = window.setTimeout(() => {
      if (!cancelled) {
        setPanicSpriteReady(true);
      }
    }, RESCUE_SCENE.panicSnooSpriteDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(delayId);
    };
  }, [phase]);

  const showFallingSprite =
    phase === 'expired' || (phase === 'panic' && panicSpriteReady);

  return (
    <div
      aria-hidden="true"
      className={`rescue-snoo absolute left-0 right-0 mx-auto w-fit z-[2] origin-bottom ${
        isExpired ? 'rescue-snoo-drop-out' : 'rescue-snoo-lift'
      }`}
      style={{
        ...(isExpired
          ? {
              '--snoo-fall-from': `${dropFromBottomPercent}%`,
              '--snoo-fall-to': `${RESCUE_SCENE.snooDropOutPercent}%`,
            }
          : { bottom: `${bottomPercent}%` }),
        transform: `scale(${
          isExpired ? dropFromScale : snooScale
        })`,
      }}
    >
      {showFallingSprite ? (
        <FallingSnooSprite />
      ) : (
        <CheerSnoo src={snooPoseSrc} />
      )}
    </div>
  );
};
