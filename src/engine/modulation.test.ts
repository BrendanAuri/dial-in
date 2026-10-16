import { describe, expect, it } from 'vitest';
import {
  ampEnvelopeValue,
  filterEnvPeakOctaves,
  lfoModulationAmount,
  releaseValue,
  segmentTimeConstant,
  tremoloBaseGain,
} from './modulation';

const env = { attack: 0.1, decay: 0.5, sustain: 0.4 };

describe('amp envelope', () => {
  it('ramps linearly through the attack', () => {
    expect(ampEnvelopeValue(env, 0)).toBe(0);
    expect(ampEnvelopeValue(env, 0.05)).toBeCloseTo(0.5);
    expect(ampEnvelopeValue(env, 0.1)).toBeCloseTo(1);
  });

  it('is about 99 % of the way to sustain after the decay time', () => {
    const remaining = (ampEnvelopeValue(env, env.attack + env.decay) - env.sustain) / (1 - env.sustain);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThan(0.015);
  });

  it('settles at sustain', () => {
    expect(ampEnvelopeValue(env, 10)).toBeCloseTo(env.sustain);
    expect(ampEnvelopeValue({ ...env, sustain: 1 }, 0.3)).toBe(1);
  });

  it('falls to about 1 % over the release time', () => {
    expect(releaseValue(0.8, 0.3, 0)).toBe(0.8);
    expect(releaseValue(0.8, 0.3, 0.3) / 0.8).toBeLessThan(0.015);
  });

  it('derives time constants from segment length', () => {
    expect(segmentTimeConstant(0)).toBe(0);
    expect(segmentTimeConstant(2)).toBeCloseTo(2 * segmentTimeConstant(1));
  });
});

describe('filter envelope', () => {
  it('uses the full amount when there is headroom', () => {
    expect(filterEnvPeakOctaves(200, 3, 18000)).toBe(3);
  });

  it('stops the peak at the top of the cutoff range', () => {
    expect(filterEnvPeakOctaves(4500, 5, 18000)).toBeCloseTo(2);
    expect(filterEnvPeakOctaves(18000, 5, 18000)).toBe(0);
  });

  it('is zero when the amount is zero', () => {
    expect(filterEnvPeakOctaves(200, 0, 18000)).toBe(0);
  });
});

describe('LFO', () => {
  it('scales depth to each target', () => {
    expect(lfoModulationAmount('off', 1)).toBe(0);
    expect(lfoModulationAmount('cutoff', 1)).toBe(3600);
    expect(lfoModulationAmount('cutoff', 0.5)).toBe(1800);
    expect(lfoModulationAmount('pitch', 1)).toBe(100);
    expect(lfoModulationAmount('amp', 1)).toBe(0.5);
  });

  it('swings amp tremolo between 1 − depth and 1', () => {
    for (const depth of [0, 0.3, 1]) {
      const base = tremoloBaseGain('amp', depth);
      const swing = lfoModulationAmount('amp', depth);
      expect(base + swing).toBeCloseTo(1);
      expect(base - swing).toBeCloseTo(1 - depth);
    }
  });

  it('leaves the tremolo stage at unity for other targets', () => {
    expect(tremoloBaseGain('cutoff', 1)).toBe(1);
    expect(tremoloBaseGain('off', 1)).toBe(1);
  });
});
