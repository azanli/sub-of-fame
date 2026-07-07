export const FORFEIT_ANGEL_SCENE = {
  imageSrc: '/snoo-angel.png',
  durationMs: 6000,
  reducedMotionDurationMs: 1500,
  segmentCount: 6,
  maxXOffsetPercent: 32,
  /** Below viewport — angel enters from the bottom */
  startYPercent: 108,
  /** Above viewport — angel exits through the top */
  endYPercent: -22,
  postRevealDelayMs: 150,
  fadeEdgeRatio: 0.06,
} as const;

export type ZigZagPathPoint = {
  progress: number;
  xPercent: number;
};

export type AngelPosition = {
  xPercent: number;
  yPercent: number;
  opacity: number;
};

const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const generateZigZagPath = (
  segmentCount: number = FORFEIT_ANGEL_SCENE.segmentCount,
  maxOffset: number = FORFEIT_ANGEL_SCENE.maxXOffsetPercent,
  random: () => number = Math.random
): ZigZagPathPoint[] => {
  const points: ZigZagPathPoint[] = [{ progress: 0, xPercent: 0 }];
  let sign = random() > 0.5 ? 1 : -1;
  const minMagnitude = maxOffset * 0.45;

  for (let segmentIndex = 1; segmentIndex < segmentCount; segmentIndex += 1) {
    const magnitude = minMagnitude + random() * (maxOffset - minMagnitude);
    points.push({
      progress: segmentIndex / segmentCount,
      xPercent: sign * magnitude,
    });
    sign *= -1;
  }

  points.push({ progress: 1, xPercent: 0 });
  return points;
};

export const createReducedMotionPath = (): ZigZagPathPoint[] => [
  { progress: 0, xPercent: 0 },
  { progress: 1, xPercent: 0 },
];

export const getOpacityAtProgress = (progress: number): number => {
  const fadeEdge = FORFEIT_ANGEL_SCENE.fadeEdgeRatio;

  if (progress <= fadeEdge) {
    return progress / fadeEdge;
  }

  if (progress >= 1 - fadeEdge) {
    return (1 - progress) / fadeEdge;
  }

  return 1;
};

export const getPositionAtProgress = (
  path: ZigZagPathPoint[],
  progress: number
): AngelPosition => {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const yPercent = lerp(
    FORFEIT_ANGEL_SCENE.startYPercent,
    FORFEIT_ANGEL_SCENE.endYPercent,
    clampedProgress
  );

  if (path.length <= 1) {
    return {
      xPercent: path[0]?.xPercent ?? 0,
      yPercent,
      opacity: getOpacityAtProgress(clampedProgress),
    };
  }

  let segmentIndex = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const nextPoint = path[index + 1];
    if (nextPoint !== undefined && clampedProgress <= nextPoint.progress) {
      segmentIndex = index;
      break;
    }
    segmentIndex = index;
  }

  const startPoint = path[segmentIndex] ?? path[0]!;
  const endPoint = path[segmentIndex + 1] ?? startPoint;
  const segmentSpan = endPoint.progress - startPoint.progress;
  const segmentProgress =
    segmentSpan > 0
      ? (clampedProgress - startPoint.progress) / segmentSpan
      : 0;

  return {
    xPercent: lerp(startPoint.xPercent, endPoint.xPercent, segmentProgress),
    yPercent,
    opacity: getOpacityAtProgress(clampedProgress),
  };
};

export const buildAngelKeyframes = (
  path: ZigZagPathPoint[],
  sampleCount = 24
): Keyframe[] => {
  const keyframes: Keyframe[] = [];

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const progress = sampleIndex / sampleCount;
    const position = getPositionAtProgress(path, progress);

    keyframes.push({
      offset: progress,
      left: `calc(50% + ${position.xPercent}%)`,
      top: `${position.yPercent}%`,
      transform: 'translateX(-50%)',
      opacity: position.opacity,
    });
  }

  return keyframes;
};

export const getForfeitAngelDurationMs = (): number =>
  prefersReducedMotion()
    ? FORFEIT_ANGEL_SCENE.reducedMotionDurationMs
    : FORFEIT_ANGEL_SCENE.durationMs;
