import { describe, expect, it } from 'vitest';
import { fillWhiteNoise } from './noise';

describe('white noise', () => {
  it('is identical for the same seed', () => {
    const a = new Float32Array(1000);
    const b = new Float32Array(1000);
    fillWhiteNoise(a, 42);
    fillWhiteNoise(b, 42);
    expect(a).toEqual(b);
  });

  it('differs for different seeds', () => {
    const a = new Float32Array(100);
    const b = new Float32Array(100);
    fillWhiteNoise(a, 1);
    fillWhiteNoise(b, 2);
    expect(a).not.toEqual(b);
  });

  it('stays in [-1, 1) with a mean near zero', () => {
    const samples = new Float32Array(20000);
    fillWhiteNoise(samples, 7);
    let sum = 0;
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThan(1);
      sum += s;
    }
    expect(Math.abs(sum / samples.length)).toBeLessThan(0.02);
  });
});
