import type { RescueAnimationPhase } from '../rescueAnimation';
import { RESCUE_SCENE_IMAGES } from '../rescueAnimation';

type RescueSpaceshipProps = {
  phase: RescueAnimationPhase;
};

const getSpaceshipMotionClass = (phase: RescueAnimationPhase): string => {
  if (phase === 'panic') {
    return 'rescue-spaceship-falter';
  }

  if (phase === 'rise') {
    return 'rescue-spaceship-swing';
  }

  return '';
};

const getSpaceshipImageSrc = (phase: RescueAnimationPhase): string => {
  if (phase === 'panic') {
    return RESCUE_SCENE_IMAGES.spaceshipPanic;
  }

  if (phase === 'expired') {
    return RESCUE_SCENE_IMAGES.spaceshipSad;
  }

  return RESCUE_SCENE_IMAGES.spaceshipHappy;
};

export const RescueSpaceship = ({ phase }: RescueSpaceshipProps) => (
  <div className={getSpaceshipMotionClass(phase)}>
    <img
      src={getSpaceshipImageSrc(phase)}
      alt=""
      aria-hidden="true"
      className="h-[clamp(2.5rem,8vw,3.25rem)] w-auto object-contain z-10"
    />
  </div>
);
