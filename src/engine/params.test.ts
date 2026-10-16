import { describe, expect, it } from 'vitest';
import { CONTINUOUS_PARAM_IDS, MODULES, PARAMS, PARAM_IDS, paramsInModule } from './params';

describe('parameter schema', () => {
  it('lists every parameter exactly once', () => {
    expect([...PARAM_IDS].sort()).toEqual(Object.keys(PARAMS).sort());
    expect(new Set(PARAM_IDS).size).toBe(PARAM_IDS.length);
  });

  it("keys each definition by its own id", () => {
    for (const id of PARAM_IDS) expect(PARAMS[id].id).toBe(id);
  });

  it('has continuous defaults inside their ranges', () => {
    for (const id of CONTINUOUS_PARAM_IDS) {
      const def = PARAMS[id];
      expect(def.min).toBeLessThan(def.max);
      expect(def.default).toBeGreaterThanOrEqual(def.min);
      expect(def.default).toBeLessThanOrEqual(def.max);
    }
  });

  it('has log-scaled parameters with a positive minimum', () => {
    for (const id of CONTINUOUS_PARAM_IDS) {
      const def = PARAMS[id];
      if (def.scale === 'log') expect(def.min).toBeGreaterThan(0);
    }
  });

  it('has discrete defaults among their options', () => {
    for (const def of [PARAMS['osc.wave'], PARAMS['osc.octave'], PARAMS['lfo.target']]) {
      const values: unknown[] = def.options.map((option) => option.value);
      expect(values).toContain(def.default);
    }
  });

  it('puts every parameter in exactly one listed module', () => {
    const grouped = MODULES.flatMap((module) => paramsInModule(module.id));
    expect([...grouped].sort()).toEqual([...PARAM_IDS].sort());
  });

  it('defaults optional modules to neutral (no effect) values', () => {
    expect(PARAMS['osc2.detune'].default).toBe(0);
    expect(PARAMS['noise.level'].default).toBe(0);
    expect(PARAMS['fenv.amount'].default).toBe(0);
    expect(PARAMS['lfo.target'].default).toBe('off');
    expect(PARAMS['lfo.depth'].default).toBe(0);
  });
});
