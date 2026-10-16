import { describe, expect, it } from 'vitest';
import { FIXTURE_PACK } from './fixtures';
import { findLevel, getPack, packLevels, unlockedControls } from './packs';

describe('packs', () => {
  it('lists levels across chapters in order', () => {
    expect(packLevels(FIXTURE_PACK).map((level) => level.id)).toEqual(['wave', 'cutoff', 'lfo']);
  });

  it('finds packs and levels by id', () => {
    expect(getPack('fixture', [FIXTURE_PACK])).toBe(FIXTURE_PACK);
    expect(getPack('nope', [FIXTURE_PACK])).toBeUndefined();
    expect(findLevel(FIXTURE_PACK, 'lfo')?.title).toBe('LFO');
    expect(findLevel(FIXTURE_PACK, 'nope')).toBeUndefined();
  });

  it('unlocks base controls plus every new control so far, in display order', () => {
    expect(unlockedControls(FIXTURE_PACK, 'wave')).toEqual(['osc.wave', 'osc.octave']);
    expect(unlockedControls(FIXTURE_PACK, 'cutoff')).toEqual(['osc.wave', 'osc.octave', 'filter.cutoff']);
    expect(unlockedControls(FIXTURE_PACK, 'lfo')).toEqual([
      'osc.wave',
      'osc.octave',
      'filter.cutoff',
      'lfo.target',
      'lfo.depth',
    ]);
  });
});
