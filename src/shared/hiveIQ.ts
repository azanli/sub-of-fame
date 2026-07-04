export const HIVE_IQ_CALIBRATION_MIN_ROUNDS = 3;
export const HIVE_IQ_FLOOR = 70;
export const HIVE_IQ_CEILING = 160;
export const RANDOM_GUESSER_ACCURACY = 1 / 3;

export type HiveIQDisplayState =
  | { kind: 'unplayed' }
  | { kind: 'calibrating' }
  | { kind: 'score'; hiveIQ: number };

/**
 * Linear Hive IQ score from slot placement counters.
 * Random guessing (33.33% accuracy) maps to 100; result is rounded and clamped to [70, 160].
 */
export const computeHiveIQScore = (
  correctSlots: number,
  totalSlots: number
): number | null => {
  if (totalSlots <= 0) {
    return null;
  }

  if (!Number.isFinite(correctSlots) || !Number.isFinite(totalSlots)) {
    return null;
  }

  const accuracy = correctSlots / totalSlots;
  const raw = 100 + (accuracy - RANDOM_GUESSER_ACCURACY) * 150;
  return Math.min(
    HIVE_IQ_CEILING,
    Math.max(HIVE_IQ_FLOOR, Math.round(raw))
  );
};

export const resolveHiveIQDisplay = (
  userSubredditHiveIQ: number | null,
  completedRoundCount: number
): HiveIQDisplayState => {
  if (
    completedRoundCount >= HIVE_IQ_CALIBRATION_MIN_ROUNDS &&
    userSubredditHiveIQ !== null
  ) {
    return { kind: 'score', hiveIQ: userSubredditHiveIQ };
  }

  if (completedRoundCount === 0) {
    return { kind: 'unplayed' };
  }

  return { kind: 'calibrating' };
};

export const formatHiveIQDisplayText = (state: HiveIQDisplayState): string => {
  if (state.kind === 'unplayed') {
    return '—';
  }

  if (state.kind === 'calibrating') {
    return 'Calibrating';
  }

  return String(state.hiveIQ);
};
