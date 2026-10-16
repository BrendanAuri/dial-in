/**
 * Pairs for the dev calibration page: a few base sounds, each compared with
 * itself, with small changes and with big ones. Identical pairs should score
 * 100, slight ones high, large ones low.
 */
import type { Patch } from '../engine/params';
import { DEFAULT_PATCH, setParam } from '../engine/patch';

export type CaseKind = 'identical' | 'slight' | 'large';

export interface CalibrationCase {
  readonly base: string;
  readonly change: string;
  readonly kind: CaseKind;
  readonly a: Patch;
  readonly b: Patch;
}

const BASES: readonly { readonly name: string; readonly patch: Patch }[] = [
  { name: 'Bright saw', patch: { ...DEFAULT_PATCH } },
  {
    name: 'Dark pluck',
    patch: {
      ...DEFAULT_PATCH,
      'filter.cutoff': 400,
      'filter.resonance': 0.3,
      'fenv.amount': 3,
      'fenv.decay': 0.25,
      'amp.decay': 0.4,
      'amp.sustain': 0.2,
    },
  },
  {
    name: 'Soft pad',
    patch: {
      ...DEFAULT_PATCH,
      'osc.wave': 'triangle',
      'osc2.detune': 15,
      'filter.cutoff': 2000,
      'amp.attack': 0.6,
      'amp.release': 1,
    },
  },
  {
    name: 'Wobble',
    patch: {
      ...DEFAULT_PATCH,
      'osc.wave': 'square',
      'osc.octave': -1,
      'filter.cutoff': 600,
      'filter.resonance': 0.5,
      'lfo.target': 'cutoff',
      'lfo.rate': 3,
      'lfo.depth': 0.5,
    },
  },
];

type Variant = readonly [change: string, kind: CaseKind, make: (p: Patch) => Patch];

const VARIANTS: readonly Variant[] = [
  ['identical', 'identical', (p) => ({ ...p })],
  ['cutoff +¼ octave', 'slight', (p) => setParam(p, 'filter.cutoff', p['filter.cutoff'] * 2 ** 0.25)],
  ['attack ×1.5', 'slight', (p) => setParam(p, 'amp.attack', p['amp.attack'] * 1.5)],
  ['resonance +0.1', 'slight', (p) => setParam(p, 'filter.resonance', p['filter.resonance'] + 0.1)],
  ['release ×1.5', 'slight', (p) => setParam(p, 'amp.release', p['amp.release'] * 1.5)],
  ['detune +4 cents', 'slight', (p) => setParam(p, 'osc2.detune', p['osc2.detune'] + 4)],
  [
    'cutoff 2 octaves away',
    'large',
    (p) => setParam(p, 'filter.cutoff', p['filter.cutoff'] > 4000 ? p['filter.cutoff'] / 4 : p['filter.cutoff'] * 4),
  ],
  ['other waveform', 'large', (p) => setParam(p, 'osc.wave', p['osc.wave'] === 'saw' ? 'square' : 'saw')],
  ['attack ×8', 'large', (p) => setParam(p, 'amp.attack', Math.max(p['amp.attack'] * 8, 0.25))],
  ['octave up', 'large', (p) => setParam(p, 'osc.octave', p['osc.octave'] === 1 ? 0 : p['osc.octave'] + 1)],
  [
    'LFO added or removed',
    'large',
    (p) =>
      p['lfo.target'] === 'off'
        ? { ...p, 'lfo.target': 'cutoff', 'lfo.rate': 4, 'lfo.depth': 0.5 }
        : { ...p, 'lfo.target': 'off', 'lfo.depth': 0 },
  ],
];

export const CALIBRATION_CASES: readonly CalibrationCase[] = BASES.flatMap((base) =>
  VARIANTS.map(([change, kind, make]) => ({ base: base.name, change, kind, a: base.patch, b: make(base.patch) })),
);
