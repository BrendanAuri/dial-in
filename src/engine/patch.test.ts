import { describe, expect, it } from 'vitest';
import { PATCH_FORMAT_VERSION } from './constants';
import { PARAMS, PARAM_IDS, type Patch } from './params';
import {
  DEFAULT_PATCH,
  deserialisePatch,
  patchesEqual,
  patchFromJson,
  patchToJson,
  serialisePatch,
  setParam,
} from './patch';

const SAMPLE: Patch = {
  ...DEFAULT_PATCH,
  'osc.wave': 'square',
  'osc.octave': -1,
  'filter.cutoff': 850,
  'filter.resonance': 0.4,
  'amp.attack': 0.25,
  'lfo.target': 'cutoff',
  'lfo.rate': 4.5,
  'lfo.depth': 0.6,
};

describe('DEFAULT_PATCH', () => {
  it('uses every schema default', () => {
    for (const id of PARAM_IDS) expect(DEFAULT_PATCH[id]).toBe(PARAMS[id].default);
  });
});

describe('serialisation', () => {
  it('round-trips a patch exactly', () => {
    expect(deserialisePatch(serialisePatch(SAMPLE))).toEqual(SAMPLE);
    expect(patchFromJson(patchToJson(SAMPLE))).toEqual(SAMPLE);
  });

  it('stores the format version and every parameter', () => {
    const data = serialisePatch(DEFAULT_PATCH);
    expect(data.v).toBe(PATCH_FORMAT_VERSION);
    expect(Object.keys(data.params).sort()).toEqual([...PARAM_IDS].sort());
  });

  it('fills missing parameters with defaults', () => {
    const patch = deserialisePatch({ v: 1, params: { 'filter.cutoff': 300 } });
    expect(patch).toEqual({ ...DEFAULT_PATCH, 'filter.cutoff': 300 });
  });

  it('drops unknown parameters', () => {
    const patch = deserialisePatch({ v: 1, params: { 'drive.amount': 0.7, 'osc.wave': 'sine' } });
    expect(patch).toEqual({ ...DEFAULT_PATCH, 'osc.wave': 'sine' });
    expect(patch).not.toHaveProperty('drive.amount');
  });

  it('clamps out-of-range numbers and rejects invalid choices', () => {
    const patch = deserialisePatch({
      v: 1,
      params: { 'filter.cutoff': 99999, 'amp.sustain': -1, 'osc.wave': 'kazoo', 'osc.octave': 3, 'lfo.rate': 'fast' },
    });
    expect(patch?.['filter.cutoff']).toBe(18000);
    expect(patch?.['amp.sustain']).toBe(0);
    expect(patch?.['osc.wave']).toBe(DEFAULT_PATCH['osc.wave']);
    expect(patch?.['osc.octave']).toBe(DEFAULT_PATCH['osc.octave']);
    expect(patch?.['lfo.rate']).toBe(DEFAULT_PATCH['lfo.rate']);
  });

  it('reads patches saved by a newer format version', () => {
    expect(deserialisePatch({ v: PATCH_FORMAT_VERSION + 1, params: { 'osc.wave': 'triangle' } })?.['osc.wave']).toBe(
      'triangle',
    );
  });

  it('returns null for things that are not patches', () => {
    expect(deserialisePatch(null)).toBeNull();
    expect(deserialisePatch('patch')).toBeNull();
    expect(deserialisePatch({ params: {} })).toBeNull();
    expect(deserialisePatch({ v: 1, params: [] })).toBeNull();
    expect(patchFromJson('{not json')).toBeNull();
  });
});

describe('patchesEqual', () => {
  it('compares every parameter', () => {
    expect(patchesEqual(SAMPLE, { ...SAMPLE })).toBe(true);
    expect(patchesEqual(SAMPLE, { ...SAMPLE, 'lfo.rate': 4.6 })).toBe(false);
    expect(patchesEqual(DEFAULT_PATCH, { ...DEFAULT_PATCH, 'osc.wave': 'sine' })).toBe(false);
  });
});

describe('setParam', () => {
  it('changes one parameter without mutating the original', () => {
    const before = { ...SAMPLE };
    const after = setParam(SAMPLE, 'filter.cutoff', 1200);
    expect(after).toEqual({ ...SAMPLE, 'filter.cutoff': 1200 });
    expect(SAMPLE).toEqual(before);
  });

  it('clamps numbers and ignores invalid values', () => {
    expect(setParam(SAMPLE, 'amp.release', 50)['amp.release']).toBe(3);
    expect(setParam(SAMPLE, 'osc.wave', 'kazoo')['osc.wave']).toBe('square');
    expect(setParam(SAMPLE, 'lfo.depth', Number.NaN)['lfo.depth']).toBe(0.6);
  });
});
