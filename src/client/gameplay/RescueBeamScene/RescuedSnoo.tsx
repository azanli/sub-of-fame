import { useRef } from 'react';
import type { RescueAnimationPhase } from '../rescueAnimation';
import { RESCUE_SCENE_IMAGES } from '../rescueAnimation';

type RescuedSnooProps = {
  bottomPercent: number;
  snooScale: number;
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
    src={RESCUE_SCENE_IMAGES.snoo}
    alt=""
    aria-hidden="true"
    className="h-[clamp(4rem,14vw,6rem)] w-auto object-contain"
  />
);

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

  const showFallingSprite = phase === 'panic' || phase === 'expired';

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
        {showFallingSprite ? <FallingSnooSprite /> : <CheerSnoo />}
      </div>
    </div>
  );
};
