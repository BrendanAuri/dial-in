/**
 * Player progress: level results, an in-progress level run, and how close
 * the player usually gets on each control. Pure functions on immutable data.
 * Progress is keyed by "packId/levelId", never by position, so packs can
 * gain or reorder levels without breaking saves.
 */
import type { Level, Pack } from '../content/schema';
import { DEFAULT_ROUNDS, PASS_MARK } from '../engine/constants';
import { MODULES, PARAM_IDS, type ParamId } from '../engine/params';
import type { ControlScore } from '../scoring/paramScore';
import { starsFor } from '../scoring/finalScore';
import { packLevels } from './packs';

export interface LevelRecord {
  /** Best run average, 0–100. */
  readonly best: number;
  readonly stars: number;
  readonly passed: boolean;
  readonly runs: number;
}

export interface ControlStat {
  /** Sum of closeness (0–1) over every round the control was scored in. */
  readonly total: number;
  readonly count: number;
}

/** A level run in progress, so it can be continued after a reload. */
export interface LevelRun {
  readonly level: string;
  readonly packVersion: number;
  /** Best score of each finished round. */
  readonly scores: readonly number[];
  /** Seed of the round being played now. */
  readonly seed: number;
}

export interface Progress {
  readonly levels: Readonly<Record<string, LevelRecord>>;
  readonly controls: Readonly<Partial<Record<ParamId, ControlStat>>>;
  readonly roundsPlayed: number;
  /** The level played most recently, as "packId/levelId". */
  readonly lastLevel: string | null;
  readonly run: LevelRun | null;
}

export const EMPTY_PROGRESS: Progress = { levels: {}, controls: {}, roundsPlayed: 0, lastLevel: null, run: null };

export interface LevelRef {
  readonly pack: Pack;
  readonly level: Level;
}

export function levelKey(packId: string, levelId: string): string {
  return `${packId}/${levelId}`;
}

export function roundsIn(level: Level): number {
  return level.rounds ?? DEFAULT_ROUNDS;
}

export function passMarkOf(level: Level): number {
  return level.passMark ?? PASS_MARK;
}

/** The rounded mean of a run's round scores. */
export function runAverage(scores: readonly number[]): number {
  return scores.length === 0 ? 0 : Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

// ── Recording ────────────────────────────────────────────────────────────

/** Count a played round and add its scored controls' closeness to the per-control stats. */
export function recordRound(progress: Progress, controls: readonly ControlScore[]): Progress {
  const next: Partial<Record<ParamId, ControlStat>> = { ...progress.controls };
  for (const control of controls) {
    if (control.inaudible !== null) continue;
    const stat = next[control.id] ?? { total: 0, count: 0 };
    next[control.id] = { total: stat.total + control.closeness, count: stat.count + 1 };
  }
  return { ...progress, controls: next, roundsPlayed: progress.roundsPlayed + 1 };
}

export function startRun(progress: Progress, ref: LevelRef, seed: number): Progress {
  const level = levelKey(ref.pack.id, ref.level.id);
  return { ...progress, lastLevel: level, run: { level, packVersion: ref.pack.version, scores: [], seed } };
}

/** Add a finished round's score to the run and move on to the round with `nextSeed`. */
export function advanceRun(progress: Progress, score: number, nextSeed: number): Progress {
  if (!progress.run) return progress;
  return { ...progress, run: { ...progress.run, scores: [...progress.run.scores, score], seed: nextSeed } };
}

/** Close the run and keep the level's best result. */
export function finishRun(progress: Progress, ref: LevelRef, scores: readonly number[]): Progress {
  const key = levelKey(ref.pack.id, ref.level.id);
  const average = runAverage(scores);
  const previous = progress.levels[key];
  const best = Math.max(previous?.best ?? 0, average);
  const record: LevelRecord = {
    best,
    stars: starsFor(best),
    passed: (previous?.passed ?? false) || average >= passMarkOf(ref.level),
    runs: (previous?.runs ?? 0) + 1,
  };
  return { ...progress, levels: { ...progress.levels, [key]: record }, lastLevel: key, run: null };
}

export function abandonRun(progress: Progress): Progress {
  return { ...progress, run: null };
}

// ── Queries ──────────────────────────────────────────────────────────────

export function levelRecord(progress: Progress, ref: LevelRef): LevelRecord | undefined {
  return progress.levels[levelKey(ref.pack.id, ref.level.id)];
}

export function isLevelPassed(progress: Progress, pack: Pack, levelId: string): boolean {
  return progress.levels[levelKey(pack.id, levelId)]?.passed ?? false;
}

export function isPackPassed(progress: Progress, pack: Pack): boolean {
  return packLevels(pack).every((level) => isLevelPassed(progress, pack, level.id));
}

/** The engine has every module the pack needs. Unsupported packs are hidden. */
export function isPackSupported(pack: Pack): boolean {
  return (pack.requires?.engineModules ?? []).every((module) => MODULES.some((m) => m.id === module));
}

/** Every pack it requires has been passed. */
export function isPackUnlocked(progress: Progress, pack: Pack, packs: readonly Pack[]): boolean {
  return (pack.requires?.packs ?? []).every((id) => {
    const required = packs.find((p) => p.id === id);
    return required !== undefined && isPackPassed(progress, required);
  });
}

/** Playable: the pack is unlocked and this is its first level or the previous one is passed. */
export function isLevelUnlocked(progress: Progress, pack: Pack, levelId: string, packs: readonly Pack[]): boolean {
  if (!isPackUnlocked(progress, pack, packs)) return false;
  const levels = packLevels(pack);
  const index = levels.findIndex((level) => level.id === levelId);
  if (index <= 0) return index === 0;
  const previous = levels[index - 1];
  return previous !== undefined && isLevelPassed(progress, pack, previous.id);
}

export interface PackSummary {
  readonly passed: number;
  readonly total: number;
  readonly stars: number;
  readonly maxStars: number;
}

export function packSummary(progress: Progress, pack: Pack): PackSummary {
  const levels = packLevels(pack);
  const records = levels.map((level) => progress.levels[levelKey(pack.id, level.id)]);
  return {
    passed: records.filter((record) => record?.passed).length,
    total: levels.length,
    stars: records.reduce((sum, record) => sum + (record?.stars ?? 0), 0),
    maxStars: levels.length * 3,
  };
}

/** The first unlocked level not yet passed, across supported packs in order; null when everything is passed. */
export function suggestedLevel(progress: Progress, packs: readonly Pack[]): LevelRef | null {
  for (const pack of packs) {
    if (!isPackSupported(pack)) continue;
    for (const level of packLevels(pack)) {
      if (isLevelUnlocked(progress, pack, level.id, packs) && !isLevelPassed(progress, pack, level.id)) {
        return { pack, level };
      }
    }
  }
  return null;
}

/** Find a "packId/levelId" key among `packs`. */
export function resolveLevel(key: string, packs: readonly Pack[]): LevelRef | null {
  for (const pack of packs) {
    for (const level of packLevels(pack)) if (levelKey(pack.id, level.id) === key) return { pack, level };
  }
  return null;
}

/** Levels the player has passed, for Practice. */
export function passedLevels(progress: Progress, packs: readonly Pack[]): LevelRef[] {
  return packs.flatMap((pack) =>
    packLevels(pack)
      .filter((level) => isLevelPassed(progress, pack, level.id))
      .map((level) => ({ pack, level })),
  );
}

export interface WeakControl {
  readonly id: ParamId;
  /** Mean closeness, 0–1. */
  readonly closeness: number;
  readonly rounds: number;
}

/** The controls with the lowest mean closeness, among those scored in at least `minRounds` rounds. */
export function weakestControls(progress: Progress, count: number, minRounds: number): WeakControl[] {
  const stats: WeakControl[] = [];
  for (const id of PARAM_IDS) {
    const stat = progress.controls[id];
    if (!stat || stat.count < minRounds) continue;
    stats.push({ id, closeness: stat.total / stat.count, rounds: stat.count });
  }
  return stats.sort((a, b) => a.closeness - b.closeness).slice(0, count);
}
