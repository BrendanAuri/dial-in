/**
 * Persisting progress: one versioned key, plus a tiny observable store so
 * every screen sees the same progress.
 */
import { PROGRESS_SCHEMA_VERSION } from '../engine/constants';
import { PARAM_IDS, type ParamId } from '../engine/params';
import type { KeyValueStore } from '../storage/storage';
import { EMPTY_PROGRESS, type ControlStat, type LevelRecord, type LevelRun, type Progress } from './progress';

export const PROGRESS_KEY = 'dialin.progress';
/** Unreadable data is copied here before anything can overwrite it. */
export const PROGRESS_RESCUE_KEY_PREFIX = 'dialin.progress.unreadable.';

const MAX_SCORE = 100;
const MAX_STARS = 3;
const MAX_SEED = 0xffffffff;

export interface LoadedProgress {
  readonly progress: Progress;
  readonly rescueKey?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isScore = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= MAX_SCORE;

function readLevel(value: unknown): LevelRecord | null {
  if (!isRecord(value) || !isScore(value.best) || typeof value.passed !== 'boolean') return null;
  const stars = isCount(value.stars) ? Math.min(MAX_STARS, value.stars) : 0;
  return { best: value.best, stars, passed: value.passed, runs: isCount(value.runs) ? value.runs : 1 };
}

function readControl(value: unknown): ControlStat | null {
  if (!isRecord(value) || !isCount(value.count) || typeof value.total !== 'number') return null;
  if (value.total < 0 || value.total > value.count) return null;
  return { total: value.total, count: value.count };
}

function readRun(value: unknown): LevelRun | null {
  if (!isRecord(value) || typeof value.level !== 'string' || !isCount(value.packVersion)) return null;
  if (!Array.isArray(value.scores) || !value.scores.every(isScore)) return null;
  if (!isCount(value.seed) || value.seed > MAX_SEED) return null;
  return { level: value.level, packVersion: value.packVersion, scores: value.scores, seed: value.seed };
}

/**
 * Read stored progress, dropping anything malformed. Only v1 exists so far;
 * later versions add migration steps here. Returns null if unrecognisable.
 */
function migrate(data: unknown): Progress | null {
  if (!isRecord(data) || typeof data.schemaVersion !== 'number') return null;
  const levels: Record<string, LevelRecord> = {};
  if (isRecord(data.levels)) {
    for (const [key, value] of Object.entries(data.levels)) {
      const record = readLevel(value);
      if (record) levels[key] = record;
    }
  }
  const controls: Partial<Record<ParamId, ControlStat>> = {};
  if (isRecord(data.controls)) {
    for (const id of PARAM_IDS) {
      const stat = readControl(data.controls[id]);
      if (stat) controls[id] = stat;
    }
  }
  return {
    levels,
    controls,
    roundsPlayed: isCount(data.roundsPlayed) ? data.roundsPlayed : 0,
    lastLevel: typeof data.lastLevel === 'string' ? data.lastLevel : null,
    run: readRun(data.run),
  };
}

export function loadProgress(store: KeyValueStore, now: number): LoadedProgress {
  const raw = store.read(PROGRESS_KEY);
  if (raw === null) return { progress: EMPTY_PROGRESS };
  let progress: Progress | null = null;
  try {
    progress = migrate(JSON.parse(raw));
  } catch {
    progress = null;
  }
  if (progress) return { progress };
  const rescueKey = `${PROGRESS_RESCUE_KEY_PREFIX}${now}`;
  store.write(rescueKey, raw);
  return { progress: EMPTY_PROGRESS, rescueKey };
}

export function saveProgress(store: KeyValueStore, progress: Progress): boolean {
  return store.write(PROGRESS_KEY, JSON.stringify({ schemaVersion: PROGRESS_SCHEMA_VERSION, ...progress }));
}

export interface ProgressStore {
  readonly getSnapshot: () => Progress;
  readonly subscribe: (listener: () => void) => () => void;
  /** Apply a change, save it, and notify. Returns false if saving failed. */
  readonly update: (change: (progress: Progress) => Progress) => boolean;
  readonly rescueKey: string | undefined;
}

export function createProgressStore(store: KeyValueStore, now: number = Date.now()): ProgressStore {
  const loaded = loadProgress(store, now);
  let progress = loaded.progress;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => progress,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update: (change) => {
      const next = change(progress);
      if (next === progress) return true;
      progress = next;
      const saved = saveProgress(store, progress);
      for (const listener of listeners) listener();
      return saved;
    },
    rescueKey: loaded.rescueKey,
  };
}
