import { describe, expect, it } from 'vitest';
import type { Level } from '../content/schema';
import type { ControlScore } from '../scoring/paramScore';
import { FIXTURE_PACK, SEQUEL_PACK } from './fixtures';
import { findLevel } from './packs';
import {
  advanceRun,
  EMPTY_PROGRESS,
  finishRun,
  isLevelUnlocked,
  isPackPassed,
  isPackSupported,
  isPackUnlocked,
  levelRecord,
  packSummary,
  passedLevels,
  recordRound,
  resolveLevel,
  runAverage,
  startRun,
  suggestedLevel,
  weakestControls,
  type Progress,
} from './progress';

const PACKS = [FIXTURE_PACK, SEQUEL_PACK];

function level(id: string): Level {
  const found = findLevel(FIXTURE_PACK, id);
  if (!found) throw new Error(id);
  return found;
}

const ref = (id: string) => ({ pack: FIXTURE_PACK, level: level(id) });

/** Run a level start to finish with the given round scores. */
function play(progress: Progress, id: string, scores: readonly number[]): Progress {
  let p = startRun(progress, ref(id), 1);
  for (const score of scores.slice(0, -1)) p = advanceRun(p, score, 2);
  return finishRun(p, ref(id), scores);
}

const control = (id: ControlScore['id'], closeness: number, inaudible: string | null = null): ControlScore => ({
  id,
  closeness,
  weight: 1,
  inaudible,
});

describe('runs', () => {
  it('tracks a run in progress and clears it when finished', () => {
    let p = startRun(EMPTY_PROGRESS, ref('wave'), 42);
    expect(p.run).toEqual({ level: 'fixture/wave', packVersion: 3, scores: [], seed: 42 });
    expect(p.lastLevel).toBe('fixture/wave');
    p = advanceRun(p, 80, 43);
    expect(p.run).toMatchObject({ scores: [80], seed: 43 });
    p = finishRun(p, ref('wave'), [80, 90, 70, 85, 95]);
    expect(p.run).toBeNull();
    expect(levelRecord(p, ref('wave'))).toEqual({ best: 84, stars: 1, passed: true, runs: 1 });
  });

  it('keeps the best average, and once passed stays passed', () => {
    let p = play(EMPTY_PROGRESS, 'wave', [95, 95, 95, 95, 95]);
    p = play(p, 'wave', [40, 40, 40, 40, 40]);
    expect(levelRecord(p, ref('wave'))).toEqual({ best: 95, stars: 2, passed: true, runs: 2 });
  });

  it("uses the level's own pass mark", () => {
    const p = play(EMPTY_PROGRESS, 'cutoff', [70, 70, 71]);
    expect(levelRecord(p, ref('cutoff'))?.passed).toBe(true);
  });

  it('averages round scores, rounded', () => {
    expect(runAverage([80, 81])).toBe(81);
    expect(runAverage([])).toBe(0);
  });
});

describe('unlocking', () => {
  it('opens levels one at a time across chapters', () => {
    let p: Progress = EMPTY_PROGRESS;
    expect(isLevelUnlocked(p, FIXTURE_PACK, 'wave', PACKS)).toBe(true);
    expect(isLevelUnlocked(p, FIXTURE_PACK, 'cutoff', PACKS)).toBe(false);
    p = play(p, 'wave', [50, 50, 50, 50, 50]);
    expect(isLevelUnlocked(p, FIXTURE_PACK, 'cutoff', PACKS)).toBe(false);
    p = play(p, 'wave', [90, 90, 90, 90, 90]);
    expect(isLevelUnlocked(p, FIXTURE_PACK, 'cutoff', PACKS)).toBe(true);
    p = play(p, 'cutoff', [90, 90, 90]);
    expect(isLevelUnlocked(p, FIXTURE_PACK, 'lfo', PACKS)).toBe(true);
    expect(isLevelUnlocked(p, FIXTURE_PACK, 'nope', PACKS)).toBe(false);
  });

  it('locks a pack until the packs it requires are passed', () => {
    let p: Progress = EMPTY_PROGRESS;
    expect(isPackUnlocked(p, SEQUEL_PACK, PACKS)).toBe(false);
    expect(isLevelUnlocked(p, SEQUEL_PACK, 'resonance', PACKS)).toBe(false);
    p = play(p, 'wave', [90, 90, 90, 90, 90]);
    p = play(p, 'cutoff', [90, 90, 90]);
    p = play(p, 'lfo', [90, 90, 90, 90, 90]);
    expect(isPackPassed(p, FIXTURE_PACK)).toBe(true);
    expect(isPackUnlocked(p, SEQUEL_PACK, PACKS)).toBe(true);
    expect(isLevelUnlocked(p, SEQUEL_PACK, 'resonance', PACKS)).toBe(true);
  });

  it('hides packs that need engine modules the engine lacks', () => {
    expect(isPackSupported(FIXTURE_PACK)).toBe(true);
    expect(isPackSupported({ ...FIXTURE_PACK, requires: { engineModules: ['filter'] } })).toBe(true);
    expect(isPackSupported({ ...FIXTURE_PACK, requires: { engineModules: ['fm'] } })).toBe(false);
  });
});

describe('summaries and suggestions', () => {
  it('suggests the first unlocked level not yet passed', () => {
    expect(suggestedLevel(EMPTY_PROGRESS, PACKS)?.level.id).toBe('wave');
    const p = play(EMPTY_PROGRESS, 'wave', [90, 90, 90, 90, 90]);
    expect(suggestedLevel(p, PACKS)?.level.id).toBe('cutoff');
  });

  it('summarises a pack', () => {
    const p = play(EMPTY_PROGRESS, 'wave', [97, 97, 97, 97, 97]);
    expect(packSummary(p, FIXTURE_PACK)).toEqual({ passed: 1, total: 3, stars: 3, maxStars: 9 });
  });

  it('lists passed levels and resolves level keys', () => {
    const p = play(EMPTY_PROGRESS, 'wave', [90, 90, 90, 90, 90]);
    expect(passedLevels(p, PACKS).map((r) => r.level.id)).toEqual(['wave']);
    expect(resolveLevel('fixture/lfo', PACKS)?.level.title).toBe('LFO');
    expect(resolveLevel('fixture/nope', PACKS)).toBeNull();
  });
});

describe('per-control stats', () => {
  it('counts rounds and averages closeness of scored controls only', () => {
    let p = recordRound(EMPTY_PROGRESS, [control('filter.cutoff', 0.5), control('filter.resonance', 0, 'not heard')]);
    p = recordRound(p, [control('filter.cutoff', 1)]);
    expect(p.roundsPlayed).toBe(2);
    expect(p.controls['filter.cutoff']).toEqual({ total: 1.5, count: 2 });
    expect(p.controls['filter.resonance']).toBeUndefined();
  });

  it('lists the weakest controls with enough rounds, worst first', () => {
    let p: Progress = EMPTY_PROGRESS;
    for (let i = 0; i < 3; i++) {
      p = recordRound(p, [control('osc.wave', 1), control('filter.cutoff', 0.4), control('amp.attack', 0.7)]);
    }
    p = recordRound(p, [control('noise.level', 0)]);
    expect(weakestControls(p, 2, 3)).toEqual([
      { id: 'filter.cutoff', closeness: expect.closeTo(0.4), rounds: 3 },
      { id: 'amp.attack', closeness: expect.closeTo(0.7), rounds: 3 },
    ]);
  });
});
