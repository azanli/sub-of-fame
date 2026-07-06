import { afterEach, describe, expect, it } from 'vitest';
import {
  RESCUE_SCENE,
  getBeamScale,
  getPanicSnooBottomPercent,
  getRescueAnimationState,
  getSnooBottomPercent,
  getSnooScale,
  waitForImage,
} from './rescueAnimation';

describe('getSnooBottomPercent', () => {
  it('keeps start below peak so snoo begins near the bottom', () => {
    expect(RESCUE_SCENE.snooStartPercent).toBeLessThan(
      RESCUE_SCENE.snooPeakPercent
    );
  });

  it('maps lift progress from start to peak', () => {
    expect(getSnooBottomPercent(0)).toBe(RESCUE_SCENE.snooStartPercent);
    expect(getSnooBottomPercent(1)).toBe(RESCUE_SCENE.snooPeakPercent);
    expect(getSnooBottomPercent(0.5)).toBeCloseTo(52);
  });
});

describe('getPanicSnooBottomPercent', () => {
  it('maps lift progress from panic low to peak without reaching start', () => {
    expect(getPanicSnooBottomPercent(0)).toBe(
      RESCUE_SCENE.snooPanicLowPercent
    );
    expect(getPanicSnooBottomPercent(1)).toBe(RESCUE_SCENE.snooPeakPercent);
    expect(getPanicSnooBottomPercent(0.5)).toBeCloseTo(63);
  });
});

describe('getSnooScale', () => {
  it('maps lift progress from full size at bottom to smaller at peak', () => {
    expect(getSnooScale(0)).toBe(RESCUE_SCENE.snooMaxScale);
    expect(getSnooScale(1)).toBe(RESCUE_SCENE.snooMinScale);
    expect(getSnooScale(0.5)).toBeCloseTo(0.8);
  });
});

describe('getBeamScale', () => {
  const maxReach = 100 - RESCUE_SCENE.snooStartPercent;

  it('maps snoo bottom from start to peak as top-down reach', () => {
    expect(getBeamScale(RESCUE_SCENE.snooStartPercent)).toBe(1);
    expect(getBeamScale(RESCUE_SCENE.snooPeakPercent)).toBeCloseTo(12 / maxReach);
    expect(getBeamScale(52)).toBeCloseTo(48 / maxReach);
  });

  it('maps panic low to a longer beam than peak', () => {
    expect(getBeamScale(RESCUE_SCENE.snooPanicLowPercent)).toBeCloseTo(
      62 / maxReach
    );
  });

  it('clamps values outside the reachable range', () => {
    expect(getBeamScale(0)).toBe(1);
    expect(getBeamScale(100)).toBe(0);
  });
});

describe('getRescueAnimationState', () => {
  const totalSeconds = 100;

  it('starts in rise phase at full time remaining', () => {
    const state = getRescueAnimationState(totalSeconds, totalSeconds);

    expect(state.phase).toBe('rise');
    expect(state.liftProgress).toBe(0);
    expect(state.snooBottomPercent).toBe(RESCUE_SCENE.snooStartPercent);
    expect(state.snooScale).toBe(RESCUE_SCENE.snooMaxScale);
    expect(state.beamScale).toBe(1);
    expect(state.isBeamVisible).toBe(true);
    expect(state.isSpaceshipFaltering).toBe(false);
  });

  it('is halfway through rise at 37.5% elapsed', () => {
    const state = getRescueAnimationState(62.5, totalSeconds);

    expect(state.phase).toBe('rise');
    expect(state.liftProgress).toBeCloseTo(0.5);
  });

  it('reaches peak at 75% elapsed', () => {
    const state = getRescueAnimationState(25, totalSeconds);

    expect(state.phase).toBe('rise');
    expect(state.liftProgress).toBeCloseTo(1);
    expect(state.snooBottomPercent).toBe(RESCUE_SCENE.snooPeakPercent);
    expect(state.snooScale).toBe(RESCUE_SCENE.snooMinScale);
    expect(state.beamScale).toBeCloseTo(12 / (100 - RESCUE_SCENE.snooStartPercent));
  });

  it('enters panic phase below 25% time remaining', () => {
    const state = getRescueAnimationState(24, totalSeconds);

    expect(state.phase).toBe('panic');
    expect(state.liftProgress).toBeCloseTo(0.96);
    expect(state.isSpaceshipFaltering).toBe(true);
    expect(state.beamIntensity).toBe(RESCUE_SCENE.panicBeamIntensity);
    expect(state.beamScale).toBeCloseTo(getBeamScale(state.snooBottomPercent));
  });

  it('is halfway through panic at 87.5% elapsed', () => {
    const state = getRescueAnimationState(12.5, totalSeconds);

    expect(state.phase).toBe('panic');
    expect(state.liftProgress).toBeCloseTo(0.5);
  });

  it('stays above panic low at one second remaining', () => {
    const state = getRescueAnimationState(1, totalSeconds);

    expect(state.phase).toBe('panic');
    expect(state.liftProgress).toBeCloseTo(0.04);
    expect(state.snooBottomPercent).toBeCloseTo(
      getPanicSnooBottomPercent(0.04)
    );
    expect(state.snooBottomPercent).toBeGreaterThan(
      RESCUE_SCENE.snooPanicLowPercent
    );
    expect(state.beamScale).toBeCloseTo(
      getBeamScale(getPanicSnooBottomPercent(0.04))
    );
  });

  it('expires when time runs out', () => {
    const state = getRescueAnimationState(0, totalSeconds);

    expect(state.phase).toBe('expired');
    expect(state.isBeamVisible).toBe(false);
    expect(state.isSpaceshipFaltering).toBe(false);
    expect(state.beamIntensity).toBe(0);
    expect(state.snooBottomPercent).toBe(RESCUE_SCENE.snooPanicLowPercent);
    expect(state.beamScale).toBe(0);
  });
});

describe('waitForImage', () => {
  const originalImage = globalThis.Image;

  afterEach(() => {
    globalThis.Image = originalImage;
  });

  it('resolves when image loads', async () => {
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      complete = false;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    } as unknown as typeof Image;

    await expect(waitForImage('/test.png')).resolves.toBeUndefined();
  });

  it('resolves when image fails to load', async () => {
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      complete = false;

      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    } as unknown as typeof Image;

    await expect(waitForImage('/missing.png')).resolves.toBeUndefined();
  });

  it('resolves immediately when image is already complete', async () => {
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      complete = true;

      set src(_value: string) {
        // already cached; no async load events
      }
    } as unknown as typeof Image;

    await expect(waitForImage('/cached.png')).resolves.toBeUndefined();
  });
});
