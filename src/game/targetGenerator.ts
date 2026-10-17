/**
 * Seeded target generation: the same pack, level and seed always give the
 * same note and target.
 */
import type {
  ChoiceGenerator,
  GeneratorParams,
  GeneratorSpec,
  GeneratorTemplate,
  Level,
  Pack,
  RangeGenerator,
} from '../content/schema';
import {
  DEFAULT_HOLD_TIME,
  TARGET_MAX_ATTEMPTS,
  TARGET_MIN_AUDIBLE_SECONDS,
  TARGET_MIN_PEAK_DB,
  TARGET_MIN_START_DISTANCE,
} from '../engine/constants';
import { noteNameToMidi } from '../engine/notes';
import {
  PARAMS,
  PARAM_IDS,
  isContinuousId,
  type ContinuousParamDef,
  type DiscreteOption,
  type ParamId,
  type Patch,
} from '../engine/params';
import { DEFAULT_PATCH, patchFromRecord } from '../engine/patch';
import { fromNormalised } from '../engine/scale';
import { isAudible } from '../scoring/audible';
import { paramDistance } from '../scoring/paramScore';
import { unlockedControls } from './packs';
import { chance, createRng, logUniform, pick, uniform, weightedPick, type Rng } from './rng';
import { estimateLoudness } from './targetChecks';

export interface GeneratedRound {
  readonly seed: number;
  /** MIDI note both target and attempt play. */
  readonly note: number;
  /** Where the knobs start: the level's fixed values over the defaults. */
  readonly start: Patch;
  readonly target: Patch;
  /** Controls the player can change, in display order. */
  readonly unlocked: readonly ParamId[];
  /** Candidates generated before one was accepted (TARGET_MAX_ATTEMPTS if none was). */
  readonly attempts: number;
  /** Id of the sound-type template the target was built from, if the level has templates. */
  readonly template: string | null;
}

/** The level's starting knob positions. */
export function startingPatch(level: Level): Patch {
  return patchFromRecord({ ...level.fixed });
}

function sampleRange(rng: Rng, def: ContinuousParamDef, gen: RangeGenerator | undefined): number {
  if (!gen) return fromNormalised(def, rng());
  if (gen.offChance !== undefined && chance(rng, gen.offChance)) return gen.offValue ?? def.default;
  const scale = gen.scale ?? def.scale;
  return scale === 'log' ? logUniform(rng, gen.min, gen.max) : uniform(rng, gen.min, gen.max);
}

function sampleChoice<V>(rng: Rng, options: readonly DiscreteOption<V>[], gen: ChoiceGenerator<V> | undefined): V {
  if (!gen) return pick(rng, options.map((option) => option.value));
  return gen.weights ? weightedPick(rng, gen.options, gen.weights) : pick(rng, gen.options);
}

/** One candidate: unlocked controls drawn from `gen`, the rest left as in `base`. */
function samplePatch(rng: Rng, gen: GeneratorParams, unlocked: ReadonlySet<ParamId>, base: Readonly<Patch>): Patch {
  const record: Record<string, unknown> = {};
  for (const id of PARAM_IDS) {
    if (!unlocked.has(id)) continue;
    record[id] = isContinuousId(id)
      ? sampleRange(rng, PARAMS[id], gen[id])
      : sampleChoice<string | number>(rng, PARAMS[id].options, gen[id]);
  }
  return patchFromRecord(record, base);
}

/** Pick one of the spec's templates by weight, or null if it has none. */
function pickTemplate(rng: Rng, spec: GeneratorSpec): GeneratorTemplate | null {
  const templates = spec.templates ?? [];
  if (templates.length === 0) return null;
  return weightedPick(rng, templates, templates.map((template) => template.weight));
}

/** A whole patch from one template, every control in play. */
export function patchFromTemplate(rng: Rng, template: GeneratorTemplate, base: Readonly<Patch> = DEFAULT_PATCH): Patch {
  return samplePatch(rng, template.params, new Set(PARAM_IDS), base);
}

/**
 * Loud and long enough to judge, and not a freebie from the starting
 * knobs: at least one focus control must be audible in the target and
 * moved away from where it starts.
 */
export function isFairTarget(target: Patch, start: Patch, note: number, focus: readonly ParamId[]): boolean {
  const context = { note, holdTime: DEFAULT_HOLD_TIME };
  const loudness = estimateLoudness(target, note, DEFAULT_HOLD_TIME);
  const moved = focus.some(
    (id) => isAudible(id, target, context) && paramDistance(id, start, target) >= TARGET_MIN_START_DISTANCE,
  );
  return loudness.peakDb >= TARGET_MIN_PEAK_DB && loudness.audibleSeconds >= TARGET_MIN_AUDIBLE_SECONDS && moved;
}

export function generateRound(pack: Pack, level: Level, seed: number): GeneratedRound {
  const rng = createRng(seed);
  const unlocked = unlockedControls(pack, level.id);
  const unlockedSet = new Set(unlocked);
  const start = startingPatch(level);
  const template = pickTemplate(rng, level.generator);
  const params: GeneratorParams = template ? { ...level.generator.params, ...template.params } : level.generator.params;
  const noteRange = template?.noteRange ?? level.noteRange;
  const low = noteNameToMidi(noteRange[0]);
  const high = noteNameToMidi(noteRange[1]);
  const note = low + Math.floor(rng() * (high - low + 1));
  // The level's own new controls must move; otherwise any unlocked one will do.
  const fresh = level.newControls.filter((id) => unlockedSet.has(id));
  const focus = fresh.length > 0 ? fresh : unlocked;

  let target = start;
  let attempts = 0;
  while (attempts < TARGET_MAX_ATTEMPTS) {
    attempts++;
    target = samplePatch(rng, params, unlockedSet, start);
    if (isFairTarget(target, start, note, focus)) break;
  }
  return { seed, note, start, target, unlocked, attempts, template: template?.id ?? null };
}
