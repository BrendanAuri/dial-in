import { describe, expect, it } from 'vitest';
import { PARAM_IDS, type Patch } from '../engine/params';
import { DEFAULT_PATCH } from '../engine/patch';
import { buildTips, hintFor, tipText } from './feedback';
import { scoreParams } from './paramScore';

const context = { note: 48, holdTime: 1.5 };
const target: Patch = {
  ...DEFAULT_PATCH,
  'osc.wave': 'saw',
  'filter.cutoff': 1000,
  'amp.attack': 0.002,
  'amp.sustain': 0.5,
  'lfo.target': 'cutoff',
  'lfo.depth': 0.5,
};

describe('tipText', () => {
  it('gives direction, size and what you hear for cutoff', () => {
    expect(tipText('filter.cutoff', { ...target, 'filter.cutoff': 500 }, target)).toBe(
      'Cutoff: about 1 octave too low, so your sound is darker than the target.',
    );
    expect(tipText('filter.cutoff', { ...target, 'filter.cutoff': 4000 }, target)).toBe(
      'Cutoff: about 2 octaves too high, so your sound is brighter than the target.',
    );
  });

  it('names and describes waveforms', () => {
    expect(tipText('osc.wave', { ...target, 'osc.wave': 'square' }, target)).toBe(
      'Waveform: you used square (hollow, odd harmonics only); the target is saw (bright and buzzy, every harmonic).',
    );
  });

  it('says when the target starts instantly', () => {
    expect(tipText('amp.attack', { ...target, 'amp.attack': 0.3 }, target)).toBe('Attack: much too slow. The target starts instantly.');
    expect(tipText('amp.attack', { ...target, 'amp.attack': 0.001 }, { ...target, 'amp.attack': 0.5 })).toMatch(/too fast/);
  });

  it('handles octaves and LFO targets', () => {
    expect(tipText('osc.octave', { ...target, 'osc.octave': 1 }, { ...target, 'osc.octave': -1 })).toBe(
      'Octave: yours is two octaves too high.',
    );
    expect(tipText('lfo.target', { ...target, 'lfo.target': 'pitch' }, target)).toBe(
      'LFO target: the target wobbles its brightness (cutoff), not its pitch (vibrato).',
    );
    expect(tipText('lfo.target', { ...target, 'lfo.target': 'off' }, target)).toMatch(/yours has the LFO off/);
    expect(tipText('lfo.target', target, { ...target, 'lfo.target': 'off' })).toMatch(/the target doesn't move/);
  });

  it('writes a tip for every control without throwing', () => {
    const far: Patch = {
      'osc.wave': 'sine',
      'osc.octave': 1,
      'osc2.detune': 40,
      'noise.level': 0.9,
      'filter.cutoff': 18000,
      'filter.resonance': 1,
      'fenv.amount': 5,
      'fenv.decay': 2,
      'amp.attack': 2,
      'amp.decay': 2,
      'amp.sustain': 1,
      'amp.release': 3,
      'lfo.target': 'amp',
      'lfo.rate': 20,
      'lfo.depth': 1,
    };
    for (const id of PARAM_IDS) {
      expect(tipText(id, far, target).length, id).toBeGreaterThan(10);
      expect(tipText(id, target, far).length, id).toBeGreaterThan(10);
    }
  });
});

describe('buildTips', () => {
  it('only covers scored controls that are noticeably off, worst first', () => {
    const mine = { ...target, 'osc.wave': 'square' as const, 'filter.cutoff': 900, 'amp.sustain': 0.1 };
    const result = scoreParams(target, mine, ['osc.wave', 'filter.cutoff', 'amp.sustain'], context);
    const tips = buildTips(result, mine, target);
    expect(tips.map((tip) => tip.id)).toEqual(['osc.wave', 'amp.sustain']);
  });

  it('gives no tips for a perfect match', () => {
    expect(buildTips(scoreParams(target, target, PARAM_IDS, context), target, target)).toEqual([]);
  });
});

describe('hintFor', () => {
  it('names the furthest-off control and a direction, without a value', () => {
    const mine = { ...target, 'filter.cutoff': 8000 };
    const hint = hintFor(scoreParams(target, mine, ['osc.wave', 'filter.cutoff'], context), mine, target);
    expect(hint).toBe('Try turning cutoff down.');
    expect(hint).not.toMatch(/\d/);
  });

  it('keeps acronyms and handles choices', () => {
    const lfo = { ...target, 'lfo.target': 'amp' as const };
    expect(hintFor(scoreParams(target, lfo, ['lfo.target'], context), lfo, target)).toBe('Try a different LFO target.');
    const fast = { ...target, 'lfo.rate': 15 };
    expect(hintFor(scoreParams(target, fast, ['lfo.rate'], context), fast, target)).toBe('Try turning LFO rate down.');
    const wave = { ...target, 'osc.wave': 'sine' as const };
    expect(hintFor(scoreParams(target, wave, ['osc.wave'], context), wave, target)).toBe('Try a different waveform.');
  });

  it('says so when everything is spot on', () => {
    expect(hintFor(scoreParams(target, target, ['osc.wave'], context), target, target)).toMatch(/spot on/);
  });
});
