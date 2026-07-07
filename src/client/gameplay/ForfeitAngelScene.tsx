import { useEffect, useRef } from 'react';
import {
  FORFEIT_ANGEL_SCENE,
  buildAngelKeyframes,
  getForfeitAngelDurationMs,
  type ZigZagPathPoint,
} from './forfeitAnimation';

type ForfeitAngelSceneProps = {
  path: ZigZagPathPoint[];
  onComplete: () => void;
};

export const ForfeitAngelScene = ({
  path,
  onComplete,
}: ForfeitAngelSceneProps) => {
  const angelRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);

  onCompleteRef.current = onComplete;

  useEffect(() => {
    const element = angelRef.current;
    if (element === null) {
      return;
    }

    const keyframes = buildAngelKeyframes(path);
    const animation = element.animate(keyframes, {
      duration: getForfeitAngelDurationMs(),
      easing: 'linear',
      fill: 'forwards',
    });

    const handleFinish = () => {
      onCompleteRef.current();
    };

    animation.addEventListener('finish', handleFinish);
    animation.addEventListener('cancel', handleFinish);

    return () => {
      animation.removeEventListener('finish', handleFinish);
      animation.removeEventListener('cancel', handleFinish);
      animation.cancel();
    };
  }, [path]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      <div
        ref={angelRef}
        className="absolute opacity-0"
        style={{
          left: '50%',
          top: `${FORFEIT_ANGEL_SCENE.startYPercent}%`,
          transform: 'translateX(-50%)',
        }}
      >
        <img
          src={FORFEIT_ANGEL_SCENE.imageSrc}
          alt=""
          aria-hidden="true"
          className="h-[clamp(5rem,16vw,7.5rem)] w-auto object-contain"
        />
      </div>
    </div>
  );
};
