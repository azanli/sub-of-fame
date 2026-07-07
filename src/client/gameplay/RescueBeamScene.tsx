import { useEffect, useState } from 'react';
import type { RescueAnimationState } from './rescueAnimation';
import {
  RESCUE_SCENE,
  RESCUE_SCENE_IMAGES,
  waitForImage,
} from './rescueAnimation';
import { RescueBeamGlow } from './RescueBeamScene/RescueBeamGlow';
import { RescuedSnoo } from './RescueBeamScene/RescuedSnoo';

type RescueBeamSceneProps = {
  animationState: RescueAnimationState;
};

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const RescueBeamScene = ({ animationState }: RescueBeamSceneProps) => {
  const [isBeamReady, setIsBeamReady] = useState(() => prefersReducedMotion());
  const [hasDeployed, setHasDeployed] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    let cancelled = false;
    let delayId: number | undefined;

    void waitForImage(RESCUE_SCENE_IMAGES.spaceshipHappy).then(() => {
      if (cancelled) {
        return;
      }

      delayId = window.setTimeout(() => {
        if (!cancelled) {
          setIsBeamReady(true);
        }
      }, RESCUE_SCENE.beamDeployDelayMs);
    });

    return () => {
      cancelled = true;
      if (delayId !== undefined) {
        window.clearTimeout(delayId);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="rescue-beam-scene pointer-events-none absolute inset-0 overflow-visible"
    >
      <RescuedSnoo
        bottomPercent={animationState.snooBottomPercent}
        snooScale={animationState.snooScale}
        phase={animationState.phase}
      />
      <RescueBeamGlow
        intensity={animationState.beamIntensity}
        isReady={isBeamReady && animationState.isBeamVisible}
        hasDeployed={hasDeployed}
        onDeployed={() => setHasDeployed(true)}
        isPulsing={animationState.phase === 'panic'}
        beamScale={animationState.beamScale}
      />
    </div>
  );
};
