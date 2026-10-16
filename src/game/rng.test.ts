import { describe, expect, it } from 'vitest';
import { PARAM_IDS } from '../engine/params';
import { deserialisePatch, serialisePatch } from '../engine/patch';
import { randomPatch } from './randomPatch';
import { chance, createRng, logUniform, pick, uniform, weightedPick } from './rng';

describe('rng', () => {
  it('repeats exactly for the same seed', () => {
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('stays in [0, 1)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 10000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('draws within ranges', () => {
    const rng = createRng(5);
    for (let i = 0; i < 1000; i++) {
      const u = uniform(rng, 2, 4);
      const l = logUniform(rng, 40, 18000);
      expect(u).toBeGreaterThanOrEqual(2);
      expect(u).toBeLessThan(4);
      expect(l).toBeGreaterThanOrEqual(40);
      expect(l).toBeLessThan(18000);
    }
  });

  it('picks items, respecting weights', () => {
    const rng = createRng(11);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[weightedPick(rng, ['a', 'b'] as const, [3, 1])]++;
    expect(counts.a / counts.b).toBeGreaterThan(2.5);
    expect(counts.a / counts.b).toBeLessThan(3.5);
    expect(['x', 'y']).toContain(pick(rng, ['x', 'y']));
    expect(() => pick(rng, [])).toThrow();
    expect(chance(rng, 0)).toBe(false);
    expect(chance(rng, 1)).toBe(true);
  });
});

describe('randomPatch', () => {
  it('always produces a valid patch', () => {
    const rng = createRng(2024);
    for (let i = 0; i < 200; i++) {
      const patch = randomPatch(rng);
      expect(deserialisePatch(serialisePatch(patch))).toEqual(patch);
      for (const id of PARAM_IDS) expect(patch[id]).toBeDefined();
    }
  });

  it('is repeatable from a seed', () => {
    expect(randomPatch(createRng(7))).toEqual(randomPatch(createRng(7)));
  });

  it('leaves LFO depth at zero when the LFO is off', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      const patch = randomPatch(rng);
      if (patch['lfo.target'] === 'off') expect(patch['lfo.depth']).toBe(0);
    }
  });
});
