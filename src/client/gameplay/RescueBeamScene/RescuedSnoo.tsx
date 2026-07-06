import { useRef } from 'react';
import type { RescueAnimationPhase } from '../rescueAnimation';
import { RESCUE_SCENE_IMAGES } from '../rescueAnimation';

type RescuedSnooProps = {
  bottomPercent: number;
  snooScale: number;
  phase: RescueAnimationPhase;
};

export const RescuedSnoo = ({
  bottomPercent,
  snooScale,
  phase,
}: RescuedSnooProps) => {
  const isExpired = phase === 'expired';
  const lastBottomPercentRef = useRef(bottomPercent);

  if (!isExpired) {
    lastBottomPercentRef.current = bottomPercent;
  }

  const displayBottomPercent = isExpired
    ? lastBottomPercentRef.current
    : bottomPercent;

  return (
    <div
      aria-hidden="true"
      className={`rescue-snoo absolute left-1/2 z-[2] origin-bottom ${
        isExpired ? '' : 'rescue-snoo-lift'
      }`}
      style={{
        bottom: `${displayBottomPercent}%`,
        transform: `translateX(-50%) scale(${snooScale})`,
      }}
    >
      <div className={isExpired ? 'rescue-snoo-drop-out' : ''}>
        <img
          src={RESCUE_SCENE_IMAGES.snoo}
          alt=""
          aria-hidden="true"
          className="h-[clamp(4rem,14vw,6rem)] w-auto object-contain"
        />
      </div>
    </div>
  );
};
