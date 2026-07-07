import { describe, expect, it } from 'vitest';
import {
  FORFEIT_ANGEL_SCENE,
  buildAngelKeyframes,
  createReducedMotionPath,
  generateZigZagPath,
  getOpacityAtProgress,
  getPositionAtProgress,
} from './forfeitAnimation';

describe('generateZigZagPath', () => {
  it('returns segmentCount + 1 points starting and ending at x=0', () => {
    const path = generateZigZagPath(6, 32, () => 0.5);

    expect(path).toHaveLength(7);
    expect(path[0]).toEqual({ progress: 0, xPercent: 0 });
    expect(path[path.length - 1]).toEqual({ progress: 1, xPercent: 0 });
  });

  it('alternates sign on interior points for a zig-zag', () => {
    const path = generateZigZagPath(6, 32, () => 0.75);

    for (let index = 1; index < path.length - 1; index += 1) {
      const point = path[index];
      expect(point?.xPercent).not.toBe(0);
      const previous = path[index - 1];
      if (previous !== undefined && previous.xPercent !== 0) {
        expect(Math.sign(point!.xPercent)).toBe(-Math.sign(previous.xPercent));
      } else if (index >= 2) {
        const prior = path[index - 1];
        expect(Math.sign(point!.xPercent)).toBe(-Math.sign(prior!.xPercent));
      }
    }
  });

  it('keeps magnitudes within configured bounds', () => {
    const path = generateZigZagPath(6, 32, () => 0.9);
    const minMagnitude = 32 * 0.45;

    for (let index = 1; index < path.length - 1; index += 1) {
      const magnitude = Math.abs(path[index]!.xPercent);
      expect(magnitude).toBeGreaterThanOrEqual(minMagnitude - 0.001);
      expect(magnitude).toBeLessThanOrEqual(32 + 0.001);
    }
  });
});

describe('getPositionAtProgress', () => {
  const path = generateZigZagPath(4, 20, () => 0.25);

  it('maps progress 0 and 1 to start and end Y positions', () => {
    expect(getPositionAtProgress(path, 0).yPercent).toBe(
      FORFEIT_ANGEL_SCENE.startYPercent
    );
    expect(getPositionAtProgress(path, 1).yPercent).toBe(
      FORFEIT_ANGEL_SCENE.endYPercent
    );
  });

  it('interpolates X between waypoints at midpoint progress', () => {
    const quarterPoint = getPositionAtProgress(path, 0.25);
    const expectedX = path[1]?.xPercent ?? 0;

    expect(quarterPoint.xPercent).toBeCloseTo(expectedX);
    expect(quarterPoint.yPercent).toBeCloseTo(
      FORFEIT_ANGEL_SCENE.startYPercent +
        (FORFEIT_ANGEL_SCENE.endYPercent - FORFEIT_ANGEL_SCENE.startYPercent) *
          0.25
    );
  });

  it('fades in and out at the edges', () => {
    expect(getOpacityAtProgress(0)).toBe(0);
    expect(getOpacityAtProgress(0.5)).toBe(1);
    expect(getOpacityAtProgress(1)).toBe(0);
    expect(getPositionAtProgress(path, 0).opacity).toBe(0);
    expect(getPositionAtProgress(path, 1).opacity).toBe(0);
  });
});

describe('createReducedMotionPath', () => {
  it('returns a straight vertical path', () => {
    expect(createReducedMotionPath()).toEqual([
      { progress: 0, xPercent: 0 },
      { progress: 1, xPercent: 0 },
    ]);
  });
});

describe('buildAngelKeyframes', () => {
  it('builds keyframes with transform and opacity for each sample', () => {
    const keyframes = buildAngelKeyframes(createReducedMotionPath(), 4);

    expect(keyframes).toHaveLength(5);
    expect(keyframes[0]).toMatchObject({
      offset: 0,
      opacity: 0,
    });
    expect(String(keyframes[2]?.top)).toContain('%');
  });
});
