import { describe, expect, it } from 'vitest';
import { PARAM_IDS, type Patch } from '../engine/params';
import { DEFAULT_PATCH } from '../engine/patch';
import { effectiveLfoTarget, inaudibleReason, isAudible } from './audible';

const context = { note: 48, holdTime: 1.5 };
const base: Patch = { ...DEFAULT_PATCH, 'filter.cutoff': 2000, 'amp.sustain': 0.5, 'lfo.target': 'pitch', 'lfo.depth': 0.3, 'fenv.amount': 1 };

describe('isAudible', () => {
  it('hears everything in an ordinary patch', () => {
    for (const id of PARAM_IDS) expect(inaudibleReason(id, base, context), id).toBeNull();
  });

  it('skips resonance when the cutoff is near the top', () => {
    expect(isAudible('filter.resonance', { ...base, 'filter.cutoff': 15000 }, context)).toBe(false);
  });

  it('skips filter envelope decay when the envelope does nothing', () => {
    expect(isAudible('fenv.decay', { ...base, 'fenv.amount': 0 }, context)).toBe(false);
    expect(isAudible('fenv.decay', { ...base, 'filter.cutoff': 18000 }, context)).toBe(false);
    expect(isAudible('fenv.amount', { ...base, 'filter.cutoff': 18000 }, context)).toBe(false);
    expect(isAudible('fenv.amount', { ...base, 'fenv.amount': 0 }, context)).toBe(true);
  });

  it('skips LFO rate and depth when the LFO is off or has no depth', () => {
    for (const patch of [{ ...base, 'lfo.target': 'off' as const }, { ...base, 'lfo.depth': 0 }]) {
      expect(isAudible('lfo.rate', patch, context)).toBe(false);
      expect(isAudible('lfo.depth', patch, context)).toBe(false);
      expect(isAudible('lfo.target', patch, context)).toBe(true);
    }
    expect(effectiveLfoTarget({ ...base, 'lfo.depth': 0.01 })).toBe('off');
  });

  it('skips decay when sustain is full, and decay and sustain when the attack outlasts the note', () => {
    expect(isAudible('amp.decay', { ...base, 'amp.sustain': 1 }, context)).toBe(false);
    const swell = { ...base, 'amp.attack': 2 };
    expect(isAudible('amp.decay', swell, context)).toBe(false);
    expect(isAudible('amp.sustain', swell, context)).toBe(false);
  });

  it('skips release when the note has already faded', () => {
    expect(isAudible('amp.release', { ...base, 'amp.sustain': 0, 'amp.decay': 0.1 }, context)).toBe(false);
    expect(isAudible('amp.release', { ...base, 'amp.sustain': 0, 'amp.decay': 2 }, context)).toBe(true);
  });

  it('skips the waveform when only the fundamental gets through', () => {
    const dark = { ...base, 'filter.cutoff': 100, 'fenv.amount': 0 };
    expect(isAudible('osc.wave', dark, context)).toBe(false);
    expect(isAudible('osc.wave', { ...dark, 'fenv.amount': 3 }, context)).toBe(true);
  });
});
