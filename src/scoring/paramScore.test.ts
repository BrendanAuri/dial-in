import { describe, expect, it } from 'vitest';
import { PARAM_IDS, type ParamId, type Patch } from '../engine/params';
import { DEFAULT_PATCH } from '../engine/patch';
import { closeness, paramDistance, scoreParams } from './paramScore';

const context = { note: 48, holdTime: 1.5 };
const target: Patch = {
  ...DEFAULT_PATCH,
  'osc.wave': 'square',
  'filter.cutoff': 800,
  'filter.resonance': 0.4,
  'amp.attack': 0.05,
  'amp.sustain': 0.6,
  'fenv.amount': 2,
  'lfo.target': 'cutoff',
  'lfo.depth': 0.5,
  'lfo.rate': 3,
  'osc2.detune': 12,
  'noise.level': 0.2,
};

describe('paramDistance', () => {
  it('measures log controls in octaves over the tolerance', () => {
    expect(paramDistance('filter.cutoff', { ...target, 'filter.cutoff': 400 }, target)).toBeCloseTo(0.5);
    expect(paramDistance('filter.cutoff', { ...target, 'filter.cutoff': 1600 }, target)).toBeCloseTo(0.5);
    expect(paramDistance('amp.attack', { ...target, 'amp.attack': 0.4 }, target)).toBeCloseTo(1);
    expect(paramDistance('lfo.rate', { ...target, 'lfo.rate': 6 }, target)).toBeCloseTo(0.5);
  });

  it('measures linear controls as a fraction of the range over the tolerance', () => {
    expect(paramDistance('filter.resonance', { ...target, 'filter.resonance': 0.65 }, target)).toBeCloseTo(0.5);
    expect(paramDistance('fenv.amount', { ...target, 'fenv.amount': 3.25 }, target)).toBeCloseTo(0.5);
  });

  it('ignores detune differences inside the deadband', () => {
    expect(paramDistance('osc2.detune', { ...target, 'osc2.detune': 13.5 }, target)).toBe(0);
    expect(paramDistance('osc2.detune', { ...target, 'osc2.detune': 24 }, target)).toBeCloseTo(10 / 25);
  });

  it('treats choices as right or wrong', () => {
    expect(paramDistance('osc.wave', { ...target, 'osc.wave': 'saw' }, target)).toBe(1);
    expect(paramDistance('osc.octave', { ...target, 'osc.octave': 1 }, target)).toBe(1);
    expect(paramDistance('osc.wave', target, target)).toBe(0);
  });

  it('compares LFO targets by what you can hear', () => {
    const still = { ...target, 'lfo.depth': 0 };
    expect(paramDistance('lfo.target', { ...still, 'lfo.target': 'pitch' }, still)).toBe(0);
    expect(paramDistance('lfo.target', { ...still, 'lfo.target': 'pitch', 'lfo.depth': 0.5 }, still)).toBe(1);
    expect(paramDistance('lfo.target', { ...target, 'lfo.depth': 0 }, target)).toBe(0);
    expect(paramDistance('lfo.target', { ...target, 'lfo.target': 'amp' }, target)).toBe(1);
  });

  it('never gives negative closeness', () => {
    expect(closeness('filter.cutoff', { ...target, 'filter.cutoff': 18000 }, target)).toBe(0);
  });
});

describe('scoreParams', () => {
  it('scores an identical patch 100', () => {
    for (const patch of [DEFAULT_PATCH, target]) {
      expect(scoreParams(patch, { ...patch }, PARAM_IDS, context).score).toBe(100);
    }
  });

  it('puts a cutoff one octave off in the expected band', () => {
    const unlocked: ParamId[] = ['osc.wave', 'osc.octave', 'filter.cutoff'];
    const off = { ...target, 'filter.cutoff': 400 };
    // waveform 2 × 1, octave 1 × 1, cutoff 2 × 0.5 → 80.
    expect(scoreParams(target, off, unlocked, context).score).toBeCloseTo(80);
    expect(scoreParams(target, off, ['filter.cutoff'], context).score).toBeCloseTo(50);
  });

  it('ignores controls that are inaudible in the target', () => {
    const open = { ...DEFAULT_PATCH, 'filter.cutoff': 18000, 'filter.resonance': 0 };
    const result = scoreParams(open, { ...open, 'filter.resonance': 0.9 }, ['filter.cutoff', 'filter.resonance'], context);
    expect(result.score).toBe(100);
    expect(result.controls.find((c) => c.id === 'filter.resonance')?.inaudible).not.toBeNull();

    const noLfo = { ...target, 'lfo.target': 'off' as const };
    expect(scoreParams(noLfo, { ...noLfo, 'lfo.rate': 15, 'lfo.depth': 1 }, ['lfo.target', 'lfo.rate', 'lfo.depth'], context).score).toBe(100);
  });

  it('weights the waveform more than the octave', () => {
    const unlocked: ParamId[] = ['osc.wave', 'osc.octave'];
    const wrongWave = scoreParams(target, { ...target, 'osc.wave': 'saw' }, unlocked, context).score;
    const wrongOctave = scoreParams(target, { ...target, 'osc.octave': 1 }, unlocked, context).score;
    expect(wrongWave).toBeLessThan(wrongOctave);
  });

  it('scores 100 when nothing unlocked can be heard', () => {
    const open = { ...DEFAULT_PATCH };
    expect(scoreParams(open, { ...open, 'filter.resonance': 1 }, ['filter.resonance'], context).score).toBe(100);
  });
});

describe('LFO speed', () => {
  const synced: Patch = { ...target, 'lfo.sync': '1/8', 'lfo.tempo': 120 };

  it('compares what you hear, however you set it', () => {
    // 1/8 at 120 BPM is 4 Hz, so a free 4 Hz LFO is a perfect match.
    expect(closeness('lfo.sync', { ...synced, 'lfo.sync': 'off', 'lfo.rate': 4 }, synced)).toBe(1);
    expect(closeness('lfo.sync', synced, synced)).toBe(1);
  });

  it('counts each note length off by its speed', () => {
    // 1/16 is twice as fast as 1/8: one octave, half the tolerance.
    expect(closeness('lfo.sync', { ...synced, 'lfo.sync': '1/16' }, synced)).toBeCloseTo(0.5);
    expect(closeness('lfo.sync', { ...synced, 'lfo.sync': '1/8T' }, synced)).toBeCloseTo(1 - Math.log2(1.5) / 2);
  });

  it('scores the speed once, under the control the target uses', () => {
    const scored = (patch: Patch) =>
      scoreParams(patch, patch, ['lfo.sync', 'lfo.rate', 'lfo.tempo'], context)
        .controls.filter((c) => c.inaudible === null)
        .map((c) => c.id);
    expect(scored(synced)).toEqual(['lfo.sync']);
    expect(scored(target)).toEqual(['lfo.rate']);
  });
});
