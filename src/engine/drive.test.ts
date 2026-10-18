import { describe, expect, it } from 'vitest';
import { DRIVE_CURVE_SIZE, DRIVE_HEADROOM } from './constants';
import { driveCurve, driveGain, driveShape } from './drive';

describe('drive', () => {
  it('has no curve with no drive, so the signal passes untouched', () => {
    expect(driveCurve(0)).toBeNull();
    expect(driveGain(0)).toBe(0);
    expect(driveShape(0.37, 0)).toBe(0.37);
  });

  it('keeps full scale at full scale and barely changes anything at a touch of drive', () => {
    for (const amount of [0.01, 0.3, 1]) expect(driveShape(1, amount)).toBeCloseTo(1, 12);
    expect(driveShape(0.5, 0.001)).toBeCloseTo(0.5, 3);
    expect(driveShape(3, 0.001)).toBeCloseTo(3, 2);
  });

  it('squashes harder as drive goes up', () => {
    const quiet = 0.3;
    expect(driveShape(quiet, 0.3)).toBeGreaterThan(quiet);
    expect(driveShape(quiet, 0.8)).toBeGreaterThan(driveShape(quiet, 0.3));
    expect(driveShape(quiet, 1)).toBeLessThanOrEqual(1);
  });

  it('builds an odd, never-falling curve over the headroom range', () => {
    const curve = driveCurve(0.6);
    if (!curve) throw new Error('expected a curve');
    expect(curve.length).toBe(DRIVE_CURVE_SIZE);
    const middle = (DRIVE_CURVE_SIZE - 1) / 2;
    expect(curve[middle]).toBe(0);
    expect(curve[0]).toBeCloseTo(-(curve[DRIVE_CURVE_SIZE - 1] ?? 0), 6);
    expect(curve[DRIVE_CURVE_SIZE - 1]).toBeCloseTo(driveShape(DRIVE_HEADROOM, 0.6) / DRIVE_HEADROOM, 6);
    for (let i = 1; i < curve.length; i++) expect(curve[i] ?? 0).toBeGreaterThanOrEqual(curve[i - 1] ?? 0);
  });
});
