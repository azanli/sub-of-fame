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

export const RescueSpaceship = ({ phase }: RescueSpaceshipProps) => (
  <div className={getSpaceshipMotionClass(phase)}>
    <img
      src={RESCUE_SCENE_IMAGES.spaceship}
      alt=""
      aria-hidden="true"
      className="h-[clamp(2.5rem,8vw,3.25rem)] w-auto object-contain z-10"
    />
  </div>
);
