import { describe, expect, it } from 'vitest';
import { memoryStore } from '../storage/storage';
import { FIXTURE_PACK } from './fixtures';
import { findLevel } from './packs';
import { EMPTY_PROGRESS, finishRun, recordRound, startRun, type Progress } from './progress';
import { createProgressStore, loadProgress, PROGRESS_KEY, saveProgress } from './progressStore';

function sample(): Progress {
  const level = findLevel(FIXTURE_PACK, 'wave');
  if (!level) throw new Error('fixture');
  const ref = { pack: FIXTURE_PACK, level };
  let p = recordRound(EMPTY_PROGRESS, [{ id: 'filter.cutoff', closeness: 0.6, weight: 2, inaudible: null }]);
  p = finishRun(startRun(p, ref, 7), ref, [90, 80, 85, 95, 70]);
  return startRun(p, ref, 99);
}

describe('progress storage', () => {
  it('round-trips', () => {
    const store = memoryStore();
    saveProgress(store, sample());
    expect(loadProgress(store, 0)).toEqual({ progress: sample() });
    expect(JSON.parse(store.read(PROGRESS_KEY) ?? '{}')).toMatchObject({ schemaVersion: 1 });
  });

  it('starts empty, and keeps a copy of unreadable data', () => {
    expect(loadProgress(memoryStore(), 0).progress).toEqual(EMPTY_PROGRESS);
    const store = memoryStore({ [PROGRESS_KEY]: 'garbage' });
    const loaded = loadProgress(store, 5);
    expect(loaded.progress).toEqual(EMPTY_PROGRESS);
    expect(store.read(loaded.rescueKey ?? '')).toBe('garbage');
  });

  it('drops malformed entries but keeps the rest', () => {
    const store = memoryStore({
      [PROGRESS_KEY]: JSON.stringify({
        schemaVersion: 1,
        levels: { 'fixture/wave': { best: 88, stars: 1, passed: true, runs: 2 }, 'fixture/bad': { best: 'lots' } },
        controls: { 'filter.cutoff': { total: 2, count: 4 }, 'osc.wave': { total: 9, count: 1 }, nonsense: { total: 1, count: 1 } },
        roundsPlayed: -3,
        lastLevel: 7,
        run: { level: 'fixture/wave', packVersion: 3, scores: [50, 'x'], seed: 1 },
      }),
    });
    expect(loadProgress(store, 0).progress).toEqual({
      levels: { 'fixture/wave': { best: 88, stars: 1, passed: true, runs: 2 } },
      controls: { 'filter.cutoff': { total: 2, count: 4 } },
      roundsPlayed: 0,
      lastLevel: null,
      run: null,
    });
  });
});

describe('createProgressStore', () => {
  it('saves every change and notifies subscribers', () => {
    const backing = memoryStore();
    const store = createProgressStore(backing);
    let calls = 0;
    store.subscribe(() => calls++);
    store.update((p) => recordRound(p, []));
    expect(store.getSnapshot().roundsPlayed).toBe(1);
    expect(calls).toBe(1);
    expect(loadProgress(backing, 0).progress.roundsPlayed).toBe(1);
    store.update((p) => p);
    expect(calls).toBe(1);
  });

  it('reports a failed save', () => {
    const store = createProgressStore({ read: () => null, write: () => false, remove: () => undefined });
    expect(store.update((p) => recordRound(p, []))).toBe(false);
  });
});
