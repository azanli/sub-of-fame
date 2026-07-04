import { describe, expect, it } from 'vitest';
import {
  computeHiveIQScore,
  formatHiveIQDisplayText,
  resolveHiveIQDisplay,
} from './hiveIQ';

describe('computeHiveIQScore', () => {
  it('returns null when totalSlots is 0', () => {
    expect(computeHiveIQScore(0, 0)).toBeNull();
  });

  it('maps random-guesser accuracy (1/3) to 100', () => {
    expect(computeHiveIQScore(3, 9)).toBe(100);
  });

  it('clamps weak measured performance to the floor', () => {
    expect(computeHiveIQScore(0, 9)).toBe(70);
  });

  it('clamps perfect accuracy to the ceiling', () => {
    expect(computeHiveIQScore(9, 9)).toBe(160);
  });

  it('returns the scaled score for above-baseline accuracy', () => {
    expect(computeHiveIQScore(6, 9)).toBe(150);
  });
});

describe('resolveHiveIQDisplay', () => {
  it('shows unplayed when no rounds are completed', () => {
    expect(resolveHiveIQDisplay(null, 0)).toEqual({ kind: 'unplayed' });
  });

  it('shows calibrating after the first rounds before three are complete', () => {
    expect(resolveHiveIQDisplay(100, 1)).toEqual({ kind: 'calibrating' });
    expect(resolveHiveIQDisplay(125, 2)).toEqual({ kind: 'calibrating' });
  });

  it('shows a numeric score after calibration completes', () => {
    expect(resolveHiveIQDisplay(100, 3)).toEqual({ kind: 'score', hiveIQ: 100 });
  });
});

describe('formatHiveIQDisplayText', () => {
  it('formats unplayed, calibrating, and score states', () => {
    expect(formatHiveIQDisplayText({ kind: 'unplayed' })).toBe('—');
    expect(formatHiveIQDisplayText({ kind: 'calibrating' })).toBe('Calibrating');
    expect(formatHiveIQDisplayText({ kind: 'score', hiveIQ: 127 })).toBe('127');
  });
});
