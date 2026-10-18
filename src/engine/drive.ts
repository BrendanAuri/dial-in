/**
 * The drive stage's maths: a tanh soft clipper, as a WaveShaper curve.
 * voice.ts scales the signal down by DRIVE_HEADROOM into the shaper and
 * back up after it, so the curve covers inputs up to ±DRIVE_HEADROOM.
 */
import { DRIVE_CURVE_SIZE, DRIVE_HEADROOM, DRIVE_MAX_GAIN } from './constants';

/** Gain into the clipper: 0 with no drive, DRIVE_MAX_GAIN − 1 at full. Exponential, so the knob turns evenly by ear. */
export function driveGain(amount: number): number {
  return DRIVE_MAX_GAIN ** amount - 1;
}

/** Drive output for input `x`: tanh(g·x) / tanh(g), so full scale (±1) stays at ±1. Exactly `x` with no drive. */
export function driveShape(x: number, amount: number): number {
  const g = driveGain(amount);
  return g > 0 ? Math.tanh(g * x) / Math.tanh(g) : x;
}

/**
 * The WaveShaper curve for `amount`, over inputs scaled down by
 * DRIVE_HEADROOM, or null with no drive: a WaveShaper without a curve
 * passes its input through untouched.
 */
export function driveCurve(amount: number): Float32Array<ArrayBuffer> | null {
  if (!(amount > 0)) return null;
  const curve = new Float32Array(DRIVE_CURVE_SIZE);
  const last = DRIVE_CURVE_SIZE - 1;
  for (let i = 0; i < DRIVE_CURVE_SIZE; i++) {
    const input = ((2 * i) / last - 1) * DRIVE_HEADROOM;
    curve[i] = driveShape(input, amount) / DRIVE_HEADROOM;
  }
  return curve;
}
