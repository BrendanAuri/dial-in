import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commit, createHistory, redo, undo } from './history';

const options = { limit: 3, coalesceMs: 500 };

describe('history', () => {
  it('undoes and redoes', () => {
    let h = createHistory(0);
    h = commit(h, 1, null, 0, options);
    h = commit(h, 2, null, 10, options);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(1);
    h = undo(h);
    expect(h.present).toBe(0);
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
  });

  it('clears redo after a new change', () => {
    let h = commit(commit(createHistory(0), 1, null, 0, options), 2, null, 0, options);
    h = commit(undo(h), 5, null, 0, options);
    expect(canRedo(h)).toBe(false);
    expect(redo(h)).toBe(h);
  });

  it('merges quick changes to the same control into one step', () => {
    let h = createHistory(0);
    h = commit(h, 1, 'cutoff', 0, options);
    h = commit(h, 2, 'cutoff', 200, options);
    h = commit(h, 3, 'cutoff', 400, options);
    expect(h.past).toEqual([0]);
    h = commit(h, 4, 'cutoff', 1000, options);
    expect(h.past).toEqual([0, 3]);
    h = commit(h, 5, 'resonance', 1100, options);
    expect(h.past).toEqual([0, 3, 4]);
  });

  it('never merges across an undo', () => {
    let h = commit(createHistory(0), 1, 'cutoff', 0, options);
    h = commit(undo(h), 2, 'cutoff', 100, options);
    expect(h.past).toEqual([0]);
    expect(h.present).toBe(2);
  });

  it('keeps at most `limit` steps', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 6; i++) h = commit(h, i, null, i * 1000, options);
    expect(h.past).toEqual([3, 4, 5]);
  });
});
