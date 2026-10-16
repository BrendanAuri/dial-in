/**
 * Undo / redo history. Rapid changes to the same control (a knob drag)
 * are merged into one step.
 */

export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  /** What the last change was to (e.g. a parameter id), for merging. */
  readonly lastKey: string | null;
  readonly lastTime: number;
}

export interface HistoryOptions {
  readonly limit: number;
  readonly coalesceMs: number;
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastTime: -Infinity };
}

/**
 * Make `next` the present. If `key` matches the previous change and it was
 * less than `coalesceMs` ago, the two become one undo step. A null key
 * never merges.
 */
export function commit<T>(history: History<T>, next: T, key: string | null, now: number, options: HistoryOptions): History<T> {
  const merge = key !== null && key === history.lastKey && now - history.lastTime < options.coalesceMs;
  if (merge) return { ...history, present: next, future: [], lastTime: now };
  return {
    past: [...history.past, history.present].slice(-options.limit),
    present: next,
    future: [],
    lastKey: key,
    lastTime: now,
  };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastKey: null,
    lastTime: -Infinity,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    lastKey: null,
    lastTime: -Infinity,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}
