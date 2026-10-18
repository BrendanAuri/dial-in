/**
 * Bass music sound types as generator templates. The motion-only versions
 * are for Bass Music levels before the envelopes are unlocked; the full
 * versions are for its finale and for Free Play's Randomise.
 */
import type { GeneratorParams, GeneratorTemplate } from './schema';

const OFF = { kind: 'range', min: 0, max: 0 } as const;
const NO_LFO = {
  'lfo.target': { kind: 'choice', options: ['off'] },
  'lfo.sync': { kind: 'choice', options: ['off'] },
  'lfo.depth': OFF,
} as const;
const SAW_OR_SQUARE = { kind: 'choice', options: ['saw', 'square'], weights: [3, 1] } as const;
const OCTAVE_0 = { kind: 'choice', options: [0] } as const;
const LOW = ['C1', 'C2'] as const;
const MID = ['C2', 'C3'] as const;

/** Held basses: a quick attack, full sustain and a short release. */
export const HELD_ENVELOPE: GeneratorParams = {
  'fenv.amount': { kind: 'range', min: 0.5, max: 2, offChance: 0.6 },
  'fenv.decay': { kind: 'range', min: 0.1, max: 0.5 },
  'amp.attack': { kind: 'range', min: 0.001, max: 0.01 },
  'amp.decay': { kind: 'range', min: 0.1, max: 0.5 },
  'amp.sustain': { kind: 'range', min: 0.8, max: 1 },
  'amp.release': { kind: 'range', min: 0.05, max: 0.3 },
};

/** A wobble: the LFO moving a resonant cutoff in time. */
export const WOBBLE: GeneratorParams = {
  'osc.wave': SAW_OR_SQUARE,
  'osc.octave': OCTAVE_0,
  'osc2.detune': { kind: 'range', min: 5, max: 20, offChance: 0.6 },
  'sub.level': OFF,
  'filter.cutoff': { kind: 'range', min: 100, max: 500 },
  'filter.resonance': { kind: 'range', min: 0.3, max: 0.7 },
  'drive.amount': { kind: 'range', min: 0.2, max: 0.6, offChance: 0.5 },
  'lfo.target': { kind: 'choice', options: ['cutoff'] },
  'lfo.sync': { kind: 'choice', options: ['1/4', '1/4T', '1/8', '1/8T', '1/16'], weights: [3, 1, 3, 2, 1] },
  'lfo.depth': { kind: 'range', min: 0.4, max: 0.8 },
};

/** A growl: heavy drive on a fast, resonant wobble. */
const GROWL: GeneratorParams = {
  'osc.wave': SAW_OR_SQUARE,
  'osc.octave': { kind: 'choice', options: [0, 1], weights: [2, 1] },
  'osc2.detune': { kind: 'range', min: 8, max: 25, offChance: 0.5 },
  'sub.level': OFF,
  'filter.cutoff': { kind: 'range', min: 150, max: 700 },
  'filter.resonance': { kind: 'range', min: 0.4, max: 0.8 },
  'drive.amount': { kind: 'range', min: 0.6, max: 1 },
  'lfo.target': { kind: 'choice', options: ['cutoff'] },
  'lfo.sync': { kind: 'choice', options: ['1/8', '1/8T', '1/16', '1/16T'], weights: [2, 2, 2, 1] },
  'lfo.depth': { kind: 'range', min: 0.25, max: 0.6 },
};

/** A reese with a slow wobble on top. */
const REESE_WOBBLE: GeneratorParams = {
  'osc.wave': { kind: 'choice', options: ['saw'] },
  'osc.octave': OCTAVE_0,
  'osc2.detune': { kind: 'range', min: 12, max: 35 },
  'sub.level': OFF,
  'filter.cutoff': { kind: 'range', min: 150, max: 600 },
  'filter.resonance': { kind: 'range', min: 0.2, max: 0.6 },
  'drive.amount': { kind: 'range', min: 0.2, max: 0.6, offChance: 0.5 },
  'lfo.target': { kind: 'choice', options: ['cutoff'] },
  'lfo.sync': { kind: 'choice', options: ['1/2', '1/4', '1/4T', '1/8'], weights: [1, 3, 1, 2] },
  'lfo.depth': { kind: 'range', min: 0.3, max: 0.7 },
};

/** Wobble templates without envelopes, for levels where they're still locked. */
export const WOBBLE_TYPES: readonly GeneratorTemplate[] = [
  { id: 'wobble', title: 'Wobble', weight: 2, params: WOBBLE },
  { id: 'growl', title: 'Growl', weight: 1, params: GROWL },
  { id: 'reese-wobble', title: 'Reese wobble', weight: 1, params: REESE_WOBBLE },
];

/** A short bass: snappy envelopes and a filter envelope that opens on every note. */
export const STAB: GeneratorParams = {
  'osc.wave': SAW_OR_SQUARE,
  'osc.octave': OCTAVE_0,
  'osc2.detune': { kind: 'range', min: 5, max: 15, offChance: 0.6 },
  'sub.level': { kind: 'range', min: 0.3, max: 0.8, offChance: 0.5 },
  'filter.cutoff': { kind: 'range', min: 80, max: 500 },
  'filter.resonance': { kind: 'range', min: 0.1, max: 0.6 },
  'drive.amount': { kind: 'range', min: 0.2, max: 0.7, offChance: 0.4 },
  'fenv.amount': { kind: 'range', min: 2, max: 4.5 },
  'fenv.decay': { kind: 'range', min: 0.05, max: 0.35 },
  'amp.attack': { kind: 'range', min: 0.001, max: 0.008 },
  'amp.decay': { kind: 'range', min: 0.1, max: 0.5 },
  'amp.sustain': { kind: 'range', min: 0, max: 0.4 },
  'amp.release': { kind: 'range', min: 0.03, max: 0.25 },
  ...NO_LFO,
};

/** Every bass type with every control set, for the Bass Music finale and Free Play. */
export const BASS_TYPES: readonly GeneratorTemplate[] = [
  {
    id: 'sub-bass',
    title: 'Sub bass',
    weight: 1,
    noteRange: MID,
    params: {
      'osc.wave': { kind: 'choice', options: ['sine', 'triangle'], weights: [2, 1] },
      'osc.octave': OCTAVE_0,
      'osc2.detune': OFF,
      'sub.level': { kind: 'range', min: 0.4, max: 1 },
      'filter.cutoff': { kind: 'range', min: 300, max: 2000 },
      'filter.resonance': { kind: 'range', min: 0, max: 0.2 },
      'drive.amount': { kind: 'range', min: 0.1, max: 0.5, offChance: 0.5 },
      ...HELD_ENVELOPE,
      ...NO_LFO,
    },
  },
  {
    id: 'reese',
    title: 'Reese',
    weight: 1,
    noteRange: LOW,
    params: {
      'osc.wave': { kind: 'choice', options: ['saw'] },
      'osc.octave': OCTAVE_0,
      'osc2.detune': { kind: 'range', min: 12, max: 40 },
      'sub.level': OFF,
      'filter.cutoff': { kind: 'range', min: 200, max: 2000 },
      'filter.resonance': { kind: 'range', min: 0, max: 0.4 },
      'drive.amount': { kind: 'range', min: 0.2, max: 0.7, offChance: 0.4 },
      ...HELD_ENVELOPE,
      ...NO_LFO,
    },
  },
  { id: 'wobble', title: 'Wobble', weight: 2, noteRange: LOW, params: { ...WOBBLE, ...HELD_ENVELOPE } },
  { id: 'growl', title: 'Growl', weight: 1, noteRange: LOW, params: { ...GROWL, ...HELD_ENVELOPE } },
  { id: 'reese-wobble', title: 'Reese wobble', weight: 1, noteRange: LOW, params: { ...REESE_WOBBLE, ...HELD_ENVELOPE } },
  { id: 'stab', title: 'Stab', weight: 1, noteRange: MID, params: STAB },
];
