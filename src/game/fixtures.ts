/** Small packs used only by tests. FIXTURE_PACK proves a second pack works with no code changes. */
import type { Pack } from '../content/schema';

export const FIXTURE_PACK: Pack = {
  id: 'fixture',
  title: 'Fixture',
  description: 'Test fixture.',
  version: 3,
  baseControls: ['osc.octave'],
  daily: [
    { id: 'easy', title: 'Easy', levelId: 'wave' },
    { id: 'hard', title: 'Hard', levelId: 'lfo' },
  ],
  chapters: [
    {
      id: 'one',
      title: 'One',
      description: '',
      levels: [
        {
          id: 'wave',
          title: 'Wave',
          intro: 'Waves.',
          newControls: ['osc.wave'],
          fixed: { 'filter.cutoff': 5000 },
          generator: { params: {} },
          noteRange: ['C3', 'C4'],
        },
        {
          id: 'cutoff',
          title: 'Cutoff',
          intro: 'Cutoff.',
          newControls: ['filter.cutoff'],
          fixed: { 'filter.cutoff': 5000, 'amp.release': 0.5 },
          generator: {
            params: {
              'osc.wave': { kind: 'choice', options: ['saw', 'square'], weights: [1, 1] },
              'filter.cutoff': { kind: 'range', min: 200, max: 2000 },
            },
          },
          noteRange: ['A2', 'A2'],
          rounds: 3,
          passMark: 70,
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
          intro: 'Wobble.',
          newControls: ['lfo.target', 'lfo.depth'],
          fixed: {},
          generator: {
            params: {
              'filter.cutoff': { kind: 'range', min: 200, max: 2000, offChance: 0.5, offValue: 12000 },
              'lfo.target': { kind: 'choice', options: ['pitch'] },
              'lfo.depth': { kind: 'range', min: 0.2, max: 0.6, offChance: 0.5, offValue: 0 },
            },
            templates: [
              { id: 'low', title: 'Low', weight: 1, noteRange: ['C1', 'C2'], params: { 'osc.wave': { kind: 'choice', options: ['sine'] } } },
              { id: 'high', title: 'High', weight: 1, params: { 'osc.wave': { kind: 'choice', options: ['saw'] } } },
            ],
          },
          noteRange: ['C3', 'C5'],
        },
      ],
    },
  ],
};

/** Requires FIXTURE_PACK, to test pack prerequisites. */
export const SEQUEL_PACK: Pack = {
  id: 'fixture.sequel',
  title: 'Sequel',
  description: 'Needs the fixture pack first.',
  version: 1,
  requires: { packs: ['fixture'] },
  baseControls: ['osc.wave', 'osc.octave'],
  chapters: [
    {
      id: 'only',
      title: 'Only',
      description: '',
      levels: [
        {
          id: 'resonance',
          title: 'Resonance',
          intro: 'Ring.',
          newControls: ['filter.resonance'],
          fixed: { 'filter.cutoff': 1000 },
          generator: { params: { 'filter.resonance': { kind: 'range', min: 0, max: 1 } } },
          noteRange: ['C3', 'C4'],
        },
      ],
    },
  ],
};
