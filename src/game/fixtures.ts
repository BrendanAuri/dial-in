/** A small pack used only by tests. */
import type { Pack } from '../content/schema';

export const FIXTURE_PACK: Pack = {
  id: 'fixture',
  title: 'Fixture',
  description: 'Test fixture.',
  version: 3,
  baseControls: ['osc.octave'],
  chapters: [
    {
      id: 'one',
      title: 'One',
      description: '',
      levels: [
        {
          id: 'wave',
          title: 'Wave',
          intro: '',
          newControls: ['osc.wave'],
          fixed: { 'filter.cutoff': 5000 },
          generator: { params: {} },
          noteRange: ['C3', 'C4'],
        },
        {
          id: 'cutoff',
          title: 'Cutoff',
          intro: '',
          newControls: ['filter.cutoff'],
          fixed: { 'filter.cutoff': 5000, 'amp.release': 0.5 },
          generator: {
            params: {
              'osc.wave': { kind: 'choice', options: ['saw', 'square'], weights: [1, 1] },
              'filter.cutoff': { kind: 'range', min: 200, max: 2000 },
            },
          },
          noteRange: ['A2', 'A2'],
        },
      ],
    },
    {
      id: 'two',
      title: 'Two',
      description: '',
      levels: [
        {
          id: 'lfo',
          title: 'LFO',
          intro: '',
          newControls: ['lfo.target', 'lfo.depth'],
          fixed: {},
          generator: {
            params: {
              'filter.cutoff': { kind: 'range', min: 200, max: 2000, offChance: 0.5, offValue: 12000 },
              'lfo.target': { kind: 'choice', options: ['pitch'] },
              'lfo.depth': { kind: 'range', min: 0.2, max: 0.6, offChance: 0.5, offValue: 0 },
            },
          },
          noteRange: ['C3', 'C5'],
        },
      ],
    },
  ],
};
