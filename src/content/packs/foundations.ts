/**
 * Foundations: the genre-neutral core pack. One area of the synth per
 * level, with earlier controls staying in play.
 */
import type { Pack } from '../schema';
import { SOUND_TYPES } from '../soundTypes';

// Generator ranges shared between levels. Later levels narrow some of them
// so the level's new control is clearly audible.
const WAVE = { kind: 'choice', options: ['sine', 'triangle', 'saw', 'square'] } as const;
const OCTAVE = { kind: 'choice', options: [-1, 0, 1], weights: [1, 2, 1] } as const;
const CUTOFF = { kind: 'range', min: 150, max: 8000 } as const;
const RESONANCE = { kind: 'range', min: 0, max: 0.6 } as const;
const ATTACK = { kind: 'range', min: 0.001, max: 0.4 } as const;
const DECAY = { kind: 'range', min: 0.05, max: 1.5 } as const;
const SUSTAIN = { kind: 'range', min: 0, max: 1 } as const;
const RELEASE = { kind: 'range', min: 0.02, max: 2 } as const;
const FENV_DECAY = { kind: 'range', min: 0.05, max: 1.2 } as const;
const LFO_RATE = { kind: 'range', min: 0.5, max: 10 } as const;
const LFO_DEPTH = { kind: 'range', min: 0.15, max: 0.8 } as const;
const LFO_MAYBE = { kind: 'choice', options: ['off', 'cutoff', 'pitch', 'amp'], weights: [3, 2, 1, 1] } as const;
const FENV_MAYBE = { kind: 'range', min: 0.5, max: 4.5, offChance: 0.5 } as const;
const DETUNE_MAYBE = { kind: 'range', min: 5, max: 40, offChance: 0.5 } as const;
const NOISE = { kind: 'range', min: 0.05, max: 0.6 } as const;

const NOTES = ['C3', 'C5'] as const;

/** Every control but noise, at the ranges used once they're all unlocked. */
const ALL_BUT_NOISE = {
  'osc.wave': WAVE,
  'osc.octave': OCTAVE,
  'osc2.detune': DETUNE_MAYBE,
  'filter.cutoff': CUTOFF,
  'filter.resonance': RESONANCE,
  'fenv.amount': FENV_MAYBE,
  'fenv.decay': FENV_DECAY,
  'amp.attack': ATTACK,
  'amp.decay': DECAY,
  'amp.sustain': SUSTAIN,
  'amp.release': RELEASE,
  'lfo.target': LFO_MAYBE,
  'lfo.rate': LFO_RATE,
  'lfo.depth': LFO_DEPTH,
} as const;

const EVERYTHING = {
  ...ALL_BUT_NOISE,
  'noise.level': { kind: 'range', min: 0.05, max: 0.4, offChance: 0.6 },
} as const;

export const FOUNDATIONS_PACK: Pack = {
  id: 'foundations',
  title: 'Foundations',
  description: 'The building blocks of every synth sound, one control at a time.',
  version: 1,
  baseControls: [],
  daily: [
    { id: 'basics', title: 'Basics', levelId: 'resonance' },
    { id: 'shapes', title: 'Shapes', levelId: 'plucks-and-sweeps' },
    { id: 'full', title: 'Full', levelId: 'sound-types' },
  ],
  chapters: [
    {
      id: 'oscillators',
      title: 'Oscillators',
      description: 'Where the sound starts.',
      levels: [
        {
          id: 'waveforms',
          title: 'Waveforms',
          intro:
            'Four basic waveforms: sine is pure, triangle soft, saw bright and buzzy, square hollow. Octave shifts the whole sound up or down.',
          newControls: ['osc.wave', 'osc.octave'],
          fixed: {},
          generator: { params: { 'osc.wave': WAVE, 'osc.octave': OCTAVE } },
          noteRange: NOTES,
        },
      ],
    },
    {
      id: 'filter',
      title: 'Filter',
      description: 'Shaping brightness.',
      levels: [
        {
          id: 'brightness',
          title: 'Brightness',
          intro: 'The lowpass filter removes everything above its cutoff. Lower cutoff, darker sound; higher, brighter.',
          newControls: ['filter.cutoff'],
          fixed: {},
          generator: { params: { 'osc.wave': WAVE, 'osc.octave': OCTAVE, 'filter.cutoff': CUTOFF } },
          noteRange: NOTES,
        },
        {
          id: 'resonance',
          title: 'Resonance',
          intro: 'Resonance boosts the frequencies right at the cutoff, adding a ringing peak. Listen for a whistle or a nasal edge.',
          newControls: ['filter.resonance'],
          fixed: {},
          generator: {
            params: {
              'osc.wave': WAVE,
              'osc.octave': OCTAVE,
              'filter.cutoff': { kind: 'range', min: 200, max: 5000 },
              'filter.resonance': { kind: 'range', min: 0, max: 0.9 },
            },
          },
          noteRange: NOTES,
        },
      ],
    },
    {
      id: 'envelopes',
      title: 'Envelopes',
      description: 'How a sound changes over time.',
      levels: [
        {
          id: 'start-and-end',
          title: 'Start and end',
          intro: 'Attack is how long a note takes to reach full volume; release is how long it fades after the note ends.',
          newControls: ['amp.attack', 'amp.release'],
          fixed: {},
          generator: {
            params: {
              'osc.wave': WAVE,
              'osc.octave': OCTAVE,
              'filter.cutoff': CUTOFF,
              'filter.resonance': RESONANCE,
              'amp.attack': { kind: 'range', min: 0.001, max: 1.2 },
              'amp.release': RELEASE,
            },
          },
          noteRange: NOTES,
        },
        {
          id: 'full-adsr',
          title: 'Full ADSR',
          intro: 'After the attack, decay sets how quickly the note falls to the sustain level, which it holds until release.',
          newControls: ['amp.decay', 'amp.sustain'],
          fixed: {},
          generator: {
            params: {
              'osc.wave': WAVE,
              'osc.octave': OCTAVE,
              'filter.cutoff': CUTOFF,
              'filter.resonance': RESONANCE,
              'amp.attack': ATTACK,
              'amp.decay': DECAY,
              'amp.sustain': SUSTAIN,
              'amp.release': RELEASE,
            },
          },
          noteRange: NOTES,
        },
        {
          id: 'plucks-and-sweeps',
          title: 'Plucks and sweeps',
          intro:
            'The filter envelope opens the cutoff at the start of each note, then closes it over its decay. A big amount and a short decay make a pluck.',
          newControls: ['fenv.amount', 'fenv.decay'],
          fixed: {},
          generator: {
            params: {
              'osc.wave': WAVE,
              'osc.octave': OCTAVE,
              'filter.cutoff': { kind: 'range', min: 80, max: 2000 },
              'filter.resonance': RESONANCE,
              'fenv.amount': { kind: 'range', min: 0.5, max: 4.5 },
              'fenv.decay': FENV_DECAY,
              'amp.attack': ATTACK,
              'amp.decay': DECAY,
              'amp.sustain': { kind: 'range', min: 0, max: 0.8 },
              'amp.release': RELEASE,
            },
          },
          noteRange: NOTES,
        },
      ],
    },
    {
      id: 'movement-and-texture',
      title: 'Movement and texture',
      description: 'Making sounds move, thicken and breathe.',
      levels: [
        {
          id: 'movement',
          title: 'Movement',
          intro:
            'The LFO is a slow wobble. It can move the cutoff (a wah), the pitch (vibrato) or the volume (tremolo). Rate is how fast; depth is how much.',
          newControls: ['lfo.target', 'lfo.rate', 'lfo.depth'],
          fixed: {},
          generator: {
            params: {
              'osc.wave': WAVE,
              'osc.octave': OCTAVE,
              'filter.cutoff': CUTOFF,
              'filter.resonance': RESONANCE,
              'fenv.amount': FENV_MAYBE,
              'fenv.decay': FENV_DECAY,
              'amp.attack': ATTACK,
              'amp.decay': DECAY,
              'amp.sustain': { kind: 'range', min: 0.4, max: 1 },
              'amp.release': RELEASE,
              'lfo.target': { kind: 'choice', options: ['cutoff', 'pitch', 'amp'], weights: [2, 1, 1] },
              'lfo.rate': LFO_RATE,
              'lfo.depth': LFO_DEPTH,
            },
          },
          noteRange: NOTES,
        },
        {
          id: 'thickness',
          title: 'Thickness',
          intro:
            'Detune splits the oscillator in two and pulls them slightly apart, so they beat against each other and sound wider and thicker.',
          newControls: ['osc2.detune'],
          fixed: {},
          generator: {
            params: { ...ALL_BUT_NOISE, 'osc2.detune': { kind: 'range', min: 5, max: 40 } },
          },
          noteRange: NOTES,
        },
        {
          id: 'air-and-grit',
          title: 'Air and grit',
          intro: 'Noise adds hiss. A little gives breath and air; more gives grit and texture.',
          newControls: ['noise.level'],
          fixed: {},
          generator: { params: { ...EVERYTHING, 'noise.level': NOISE } },
          noteRange: NOTES,
        },
      ],
    },
    {
      id: 'putting-it-together',
      title: 'Putting it together',
      description: 'Everything at once, as real sound types.',
      levels: [
        {
          id: 'sound-types',
          title: 'Sound types',
          intro:
            'Everything together, built from common sound types: plucks, pads, leads, basses and brass. Listen for the big shape first.',
          newControls: [],
          fixed: {},
          generator: { params: EVERYTHING, templates: SOUND_TYPES },
          noteRange: NOTES,
        },
      ],
    },
  ],
};
