export type RescueAnimationPhase = 'rise' | 'panic' | 'expired';

export const RESCUE_SCENE = {
  snooStartPercent: 16,
  snooPeakPercent: 88,
  /** Lowest Snoo position during panic; full exit happens only on expiry */
  snooPanicLowPercent: 38,
  snooDropOutPercent: 110,
  snooMaxScale: 1,
  snooMinScale: 0.6,
  risePhaseEndRatio: 0.75,
  baseBeamIntensity: 0.85,
  panicBeamIntensity: 1,
  beamMaxHeightCss: 'calc(84% + clamp(1rem, 4vh, 2rem))',
  beamDeployDelayMs: 300,
  beamDeployDurationMs: 400,
} as const;

export const RESCUE_SCENE_IMAGES = {
  spaceshipHappy: '/spaceship-happy.png',
  spaceshipPanic: '/spaceship-panic.png',
  spaceshipSad: '/spaceship-sad.png',
  snoo: '/snoo-cheer-two.png',
  snooFalling1: '/snoo-falling-1.png',
  snooFalling2: '/snoo-falling-2.png',
  snooAngel: '/snoo-angel.png',
} as const;

export const preloadRescueSceneImages = (): void => {
  for (const src of Object.values(RESCUE_SCENE_IMAGES)) {
    const img = new Image();
    img.src = src;
  }
};

export const waitForImage = (src: string): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image();
    const finish = () => resolve();
    img.onload = finish;
    img.onerror = finish;
    img.src = src;
    if (img.complete) {
      finish();
    }
  });

export type RescueAnimationState = {
  phase: RescueAnimationPhase;
  /** 0 = start height, 1 = peak height; used in rise/panic */
  liftProgress: number;
  /** 0–1 beam intensity multiplier */
  beamIntensity: number;
  isBeamVisible: boolean;
  isSpaceshipFaltering: boolean;
  snooBottomPercent: number;
  snooScale: number;
  /** 0–1 vertical scale for the beam cone */
  beamScale: number;
};

const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

export const getSnooBottomPercent = (liftProgress: number): number =>
  lerp(
    RESCUE_SCENE.snooStartPercent,
    RESCUE_SCENE.snooPeakPercent,
    liftProgress
  );

export const getPanicSnooBottomPercent = (liftProgress: number): number =>
  lerp(
    RESCUE_SCENE.snooPanicLowPercent,
    RESCUE_SCENE.snooPeakPercent,
    liftProgress
  );

export const getSnooScale = (liftProgress: number): number =>
  lerp(RESCUE_SCENE.snooMaxScale, RESCUE_SCENE.snooMinScale, liftProgress);

export const getBeamScale = (snooBottomPercent: number): number => {
  const maxReach = 100 - RESCUE_SCENE.snooStartPercent;
  const currentReach = 100 - snooBottomPercent;

  return Math.min(1, Math.max(0, currentReach / maxReach));
};

export const getRescueAnimationState = (
  secondsRemaining: number,
  totalSeconds: number
): RescueAnimationState => {
  if (secondsRemaining <= 0 || totalSeconds <= 0) {
    return {
      phase: 'expired',
      liftProgress: 0,
      beamIntensity: 0,
      isBeamVisible: false,
      isSpaceshipFaltering: false,
      snooBottomPercent: RESCUE_SCENE.snooPanicLowPercent,
      snooScale: getSnooScale(0),
      beamScale: 0,
    };
  }

  const elapsedRatio = 1 - secondsRemaining / totalSeconds;

  if (elapsedRatio <= RESCUE_SCENE.risePhaseEndRatio) {
    const liftProgress = elapsedRatio / RESCUE_SCENE.risePhaseEndRatio;

    const snooBottomPercent = getSnooBottomPercent(liftProgress);

    return {
      phase: 'rise',
      liftProgress,
      beamIntensity: RESCUE_SCENE.baseBeamIntensity,
      isBeamVisible: true,
      isSpaceshipFaltering: false,
      snooBottomPercent,
      snooScale: getSnooScale(liftProgress),
      beamScale: getBeamScale(snooBottomPercent),
    };
  }

  const panicProgress =
    (elapsedRatio - RESCUE_SCENE.risePhaseEndRatio) /
    (1 - RESCUE_SCENE.risePhaseEndRatio);
  const liftProgress = 1 - panicProgress;

  const snooBottomPercent = getPanicSnooBottomPercent(liftProgress);

  return {
    phase: 'panic',
    liftProgress,
    beamIntensity: RESCUE_SCENE.panicBeamIntensity,
    isBeamVisible: true,
    isSpaceshipFaltering: true,
    snooBottomPercent,
    snooScale: getSnooScale(liftProgress),
    beamScale: getBeamScale(snooBottomPercent),
  };
};
