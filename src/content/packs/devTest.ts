/**
 * Temporary test levels for trying rounds before the Foundations pack
 * exists (Milestone 6). Becomes the not-shipped test fixture pack then.
 */
import type { Pack } from '../schema';

export const DEV_TEST_PACK: Pack = {
  id: 'dev',
  title: 'Test levels',
  description: 'Temporary levels for trying out rounds.',
  version: 1,
  baseControls: [],
  chapters: [
    {
      id: 'basics',
      title: 'Basics',
      description: 'A quick tour, one area of the synth at a time.',
      levels: [
        {
          id: 'waveforms',
          title: 'Waveforms',
          intro: 'Match the waveform and octave. Sine is pure, triangle soft, saw buzzy, square hollow.',
          newControls: ['osc.wave', 'osc.octave'],
          fixed: {},
          generator: { params: {} },
          noteRange: ['C3', 'C5'],
        },
        {
          id: 'brightness',
          title: 'Brightness',
          intro: 'Now the filter cutoff too. Lower cutoff, darker sound.',
          newControls: ['filter.cutoff'],
          fixed: {},
          generator: { params: { 'filter.cutoff': { kind: 'range', min: 150, max: 8000 } } },
          noteRange: ['C3', 'C5'],
        },
        {
          id: 'shape',
          title: 'Start and end',
          intro: 'Attack is how the note starts; release is how it fades after it ends.',
          newControls: ['amp.attack', 'amp.release'],
          fixed: {},
          generator: {
            params: {
              'filter.cutoff': { kind: 'range', min: 300, max: 8000 },
              'amp.attack': { kind: 'range', min: 0.001, max: 1 },
              'amp.release': { kind: 'range', min: 0.02, max: 2 },
            },
          },
          noteRange: ['C3', 'C5'],
        },
        {
          id: 'everything',
          title: 'Everything',
          intro: 'Every control is unlocked. Listen for the big things first: waveform, brightness, shape.',
          newControls: [
            'filter.resonance',
            'amp.decay',
            'amp.sustain',
            'fenv.amount',
            'fenv.decay',
            'lfo.target',
            'lfo.rate',
            'lfo.depth',
            'osc2.detune',
            'noise.level',
          ],
          fixed: {},
          generator: {
            params: {
              'osc2.detune': { kind: 'range', min: 3, max: 30, offChance: 0.5 },
              'noise.level': { kind: 'range', min: 0.05, max: 0.4, offChance: 0.7 },
              'filter.cutoff': { kind: 'range', min: 150, max: 8000 },
              'filter.resonance': { kind: 'range', min: 0, max: 0.7 },
              'fenv.amount': { kind: 'range', min: 0.5, max: 4, offChance: 0.5 },
              'fenv.decay': { kind: 'range', min: 0.05, max: 1 },
              'amp.attack': { kind: 'range', min: 0.001, max: 0.8 },
              'amp.decay': { kind: 'range', min: 0.05, max: 1.5 },
              'amp.release': { kind: 'range', min: 0.02, max: 1.5 },
              'lfo.target': { kind: 'choice', options: ['off', 'cutoff', 'pitch', 'amp'], weights: [3, 2, 1, 1] },
              'lfo.rate': { kind: 'range', min: 0.3, max: 10 },
              'lfo.depth': { kind: 'range', min: 0.1, max: 0.7 },
            },
          },
          noteRange: ['C3', 'C5'],
        },
      ],
    },
  ],
};
