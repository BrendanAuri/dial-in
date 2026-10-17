import { describe, expect, it } from 'vitest';
import { PACKS } from '../content';
import type { Level, Pack } from '../content/schema';
import { PARAM_IDS } from '../engine/params';
import { FIXTURE_PACK, SEQUEL_PACK } from './fixtures';
import { packLevels, unlockedControls } from './packs';
import { validatePack, validatePacks } from './validation';

const level: Level = {
  id: 'one',
  title: 'One',
  intro: 'Intro.',
  newControls: ['osc.wave'],
  fixed: {},
  generator: { params: {} },
  noteRange: ['C3', 'C4'],
};

function packWith(changes: Partial<Level>, extra: Partial<Pack> = {}): Pack {
  return {
    id: 'test',
    title: 'Test',
    description: '',
    version: 1,
    baseControls: [],
    chapters: [{ id: 'c', title: 'C', description: '', levels: [{ ...level, ...changes }] }],
    ...extra,
  };
}

const errorsFor = (pack: Pack): string[] => validatePack(pack, [pack]);

describe('shipped content', () => {
  it('passes validation', () => {
    expect(validatePacks(PACKS)).toEqual([]);
  });

  it('unlocks every control by the end of Foundations', () => {
    const foundations = PACKS.find((p) => p.id === 'foundations');
    const last = foundations ? packLevels(foundations).at(-1) : undefined;
    expect(foundations && last ? unlockedControls(foundations, last.id) : []).toEqual(PARAM_IDS);
  });

  it('includes valid test fixtures', () => {
    expect(validatePacks([FIXTURE_PACK, SEQUEL_PACK])).toEqual([]);
  });
});

describe('validatePack', () => {
  it('accepts a minimal pack', () => {
    expect(errorsFor(packWith({}))).toEqual([]);
  });

  it('catches bad ids and duplicates', () => {
    expect(errorsFor(packWith({ id: 'Bad Id' }))).toEqual([expect.stringMatching(/level id/)]);
    expect(errorsFor({ ...packWith({}), id: 'UPPER' })).toEqual([expect.stringMatching(/pack id/)]);
    const twice = packWith({});
    const doubled: Pack = { ...twice, chapters: [...twice.chapters, { ...twice.chapters[0]!, id: 'd' }] };
    expect(errorsFor(doubled)).toEqual(
      expect.arrayContaining([expect.stringMatching(/level id "one" is used twice/), expect.stringMatching(/introduced more than once/)]),
    );
    expect(validatePacks([packWith({}), packWith({})])).toEqual(expect.arrayContaining([expect.stringMatching(/pack id "test" is used twice/)]));
  });

  it('catches unknown and locked controls', () => {
    const unknown = packWith({ generator: { params: { 'filter.cutoff': { kind: 'range', min: 100, max: 200 } } } });
    expect(errorsFor(unknown)).toEqual([expect.stringMatching(/filter.cutoff has a generator but is still locked/)]);
    const typo = packWith({ fixed: { ...({ 'filter.cutof': 100 } as object) } });
    expect(errorsFor(typo)).toEqual([expect.stringMatching(/unknown fixed control "filter.cutof"/)]);
  });

  it('catches ranges outside the control and bad choices', () => {
    const cutoff = packWith({
      newControls: ['osc.wave', 'filter.cutoff', 'amp.attack'],
      generator: {
        params: {
          'osc.wave': { kind: 'choice', options: ['saw', 'square'], weights: [1] },
          'filter.cutoff': { kind: 'range', min: 10, max: 50000 },
          'amp.attack': { kind: 'range', min: 0.5, max: 0.1 },
        },
      },
    });
    const errors = errorsFor(cutoff);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/osc.wave needs one weight per option/),
        expect.stringMatching(/filter.cutoff range is outside/),
        expect.stringMatching(/amp.attack min is above max/),
      ]),
    );
  });

  it('catches bad note ranges, rounds and pass marks', () => {
    expect(errorsFor(packWith({ noteRange: ['C5', 'C3'] }))).toEqual([expect.stringMatching(/backwards/)]);
    expect(errorsFor(packWith({ noteRange: ['X9', 'C3'] }))).toEqual([expect.stringMatching(/isn't valid/)]);
    expect(errorsFor(packWith({ rounds: 0 }))).toEqual([expect.stringMatching(/rounds/)]);
    expect(errorsFor(packWith({ passMark: 120 }))).toEqual([expect.stringMatching(/pass mark/)]);
  });

  it('catches requirements that do not resolve', () => {
    expect(errorsFor(packWith({}, { requires: { packs: ['nope'], engineModules: ['warp-drive'] } }))).toEqual([
      expect.stringMatching(/unknown pack "nope"/),
      expect.stringMatching(/unknown engine module "warp-drive"/),
    ]);
  });

  it('checks daily tiers', () => {
    const pack = packWith({}, { daily: [{ id: 'a', title: 'A', levelId: 'one' }, { id: 'a', title: 'A2', levelId: 'missing' }] });
    expect(errorsFor(pack)).toEqual([
      expect.stringMatching(/daily tier id "a" is used twice/),
      expect.stringMatching(/uses unknown level "missing"/),
    ]);
  });

  it('checks templates like the level generator', () => {
    const pack = packWith({
      generator: {
        params: {},
        templates: [
          { id: 't', title: 'T', weight: 0, params: { 'osc.wave': { kind: 'choice', options: ['kazoo' as 'saw'] } } },
          { id: 't', title: 'T2', weight: 1, params: {}, noteRange: ['C4', 'C2'] },
        ],
      },
    });
    expect(errorsFor(pack)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/template id "t" is used twice/),
        expect.stringMatching(/weight must be positive/),
        expect.stringMatching(/option kazoo isn't valid/),
        expect.stringMatching(/backwards/),
      ]),
    );
  });
});
