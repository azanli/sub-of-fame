import type { AnimationEvent } from 'react';
import { RESCUE_SCENE } from '../rescueAnimation';

type RescueBeamGlowProps = {
  intensity: number;
  isReady: boolean;
  hasDeployed: boolean;
  onDeployed: () => void;
  isPulsing: boolean;
  snooBottomPercent: number;
};

export const RescueBeamGlow = ({
  intensity,
  isReady,
  hasDeployed,
  onDeployed,
  isPulsing,
  snooBottomPercent,
}: RescueBeamGlowProps) => {
  if (!isReady) {
    return null;
  }

  const isDeploying = !hasDeployed;

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.animationName !== 'rescue-beam-deploy-keyframes') {
      return;
    }

    onDeployed();
  };

  return (
    <div
      aria-hidden="true"
      className={`rescue-beam-container rescue-beam-track absolute left-1/2 z-[1] w-full -translate-x-1/2 ${RESCUE_SCENE.beamOriginPullUpClass}`}
      style={{
        bottom: `${snooBottomPercent}%`,
        opacity: intensity,
      }}
    >
      <div
        className={isDeploying ? 'rescue-beam-deploy-inner size-full' : 'size-full'}
        onAnimationEnd={handleAnimationEnd}
      >
        <div
          className={`rescue-beam-cone size-full ${
            isPulsing ? 'rescue-beam-pulse' : ''
          }`}
        />
      </div>
    </div>
  );
};
