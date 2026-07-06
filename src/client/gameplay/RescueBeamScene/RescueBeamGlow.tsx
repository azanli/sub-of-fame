import type { AnimationEvent } from 'react';
import { RESCUE_SCENE } from '../rescueAnimation';

type RescueBeamGlowProps = {
  intensity: number;
  isReady: boolean;
  hasDeployed: boolean;
  onDeployed: () => void;
  isPulsing: boolean;
  beamScale: number;
};

export const RescueBeamGlow = ({
  intensity,
  isReady,
  hasDeployed,
  onDeployed,
  isPulsing,
  beamScale,
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
      className="rescue-beam-container rescue-beam-track absolute inset-x-0 z-[1] -top-[clamp(1rem,4vh,2rem)]"
      style={{
        height: RESCUE_SCENE.beamMaxHeightCss,
        opacity: intensity,
      }}
    >
      <div
        className="rescue-beam-scaler size-full"
        style={{ transform: `scaleY(${beamScale})` }}
      >
        <div
          className={
            isDeploying ? 'rescue-beam-deploy-inner size-full' : 'size-full'
          }
          onAnimationEnd={handleAnimationEnd}
        >
          <div
            className={`rescue-beam-cone size-full ${
              isPulsing ? 'rescue-beam-pulse' : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
};
