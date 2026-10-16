import { describe, expect, it } from 'vitest';
import { CONTINUOUS_PARAM_IDS, PARAMS } from './params';
import { clamp01, clampToRange, fromNormalised, toNormalised } from './scale';

const cutoff = PARAMS['filter.cutoff'];
const sustain = PARAMS['amp.sustain'];
const detune = PARAMS['osc2.detune'];
const attack = PARAMS['amp.attack'];

describe('linear scale', () => {
  it('maps the ends and middle of the range', () => {
    expect(fromNormalised(detune, 0)).toBe(0);
    expect(fromNormalised(detune, 0.5)).toBe(25);
    expect(fromNormalised(detune, 1)).toBe(50);
    expect(toNormalised(sustain, 0.25)).toBeCloseTo(0.25);
  });
});

describe('log scale', () => {
  it('maps the ends of the range', () => {
    expect(fromNormalised(cutoff, 0)).toBeCloseTo(40);
    expect(fromNormalised(cutoff, 1)).toBeCloseTo(18000);
  });

  it('puts the geometric mean at the middle', () => {
    expect(fromNormalised(cutoff, 0.5)).toBeCloseTo(Math.sqrt(40 * 18000), 6);
    expect(toNormalised(attack, Math.sqrt(0.001 * 2))).toBeCloseTo(0.5);
  });

  it('gives equal knob travel for each octave', () => {
    const stepA = toNormalised(cutoff, 400) - toNormalised(cutoff, 200);
    const stepB = toNormalised(cutoff, 4000) - toNormalised(cutoff, 2000);
    expect(stepA).toBeCloseTo(stepB);
  });
});

describe('round trips', () => {
  it('returns the same value for every continuous parameter', () => {
    for (const id of CONTINUOUS_PARAM_IDS) {
      const def = PARAMS[id];
      for (const n of [0, 0.1, 0.33, 0.5, 0.77, 1]) {
        expect(toNormalised(def, fromNormalised(def, n))).toBeCloseTo(n, 9);
      }
    }
  });
});

describe('clamping', () => {
  it('clamps positions outside 0–1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(fromNormalised(cutoff, 2)).toBeCloseTo(18000);
    expect(fromNormalised(cutoff, -1)).toBeCloseTo(40);
  });

  it('clamps values outside the range', () => {
    expect(clampToRange(cutoff, 5)).toBe(40);
    expect(clampToRange(cutoff, 1e6)).toBe(18000);
    expect(toNormalised(cutoff, 1e6)).toBe(1);
    expect(toNormalised(sustain, -3)).toBe(0);
  });

  it('turns non-finite values into the default', () => {
    expect(clampToRange(cutoff, Number.NaN)).toBe(cutoff.default);
    expect(clampToRange(sustain, Number.POSITIVE_INFINITY)).toBe(sustain.default);
    expect(fromNormalised(detune, Number.NaN)).toBe(0);
  });
});
