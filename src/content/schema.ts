/**
 * Content types: packs, chapters, levels and how targets are generated.
 * Everything here is plain, JSON-serialisable data.
 */
import type { DiscreteParamId, ParamId, Patch } from '../engine/params';

/** Draw a continuous parameter from [min, max]. */
export interface RangeGenerator {
  readonly kind: 'range';
  readonly min: number;
  readonly max: number;
  /** Defaults to the parameter's own scale (log for times and frequencies). */
  readonly scale?: 'linear' | 'log';
  /** Chance of using `offValue` instead of a value from the range. */
  readonly offChance?: number;
  /** Defaults to the parameter's default. */
  readonly offValue?: number;
}

/** Pick a discrete parameter's value, optionally weighted. */
export interface ChoiceGenerator<V> {
  readonly kind: 'choice';
  readonly options: readonly V[];
  /** Relative weights, one per option. Equal if omitted. */
  readonly weights?: readonly number[];
}

export type ParamGenerator<K extends ParamId> = K extends DiscreteParamId ? ChoiceGenerator<Patch[K]> : RangeGenerator;

export type GeneratorParams = { readonly [K in ParamId]?: ParamGenerator<K> };

/** A sound type (pluck, pad…): generator settings that override the level's, picked by weight. */
export interface GeneratorTemplate {
  readonly id: string;
  readonly title: string;
  readonly weight: number;
  readonly params: GeneratorParams;
  /** Overrides the level's note range, e.g. lower for basses. */
  readonly noteRange?: readonly [string, string];
}

/**
 * How a level's targets are generated. Unlocked controls without an entry
 * use their full range (or every option). With templates, one is picked
 * per round and its settings override these.
 */
export interface GeneratorSpec {
  readonly params: GeneratorParams;
  readonly templates?: readonly GeneratorTemplate[];
}

export interface Level {
  /** Unique within the pack. */
  readonly id: string;
  readonly title: string;
  /** One or two sentences shown before the first round. */
  readonly intro: string;
  /** Unlocked from this level onwards. */
  readonly newControls: readonly ParamId[];
  /** Values for controls that are still locked (and where unlocked knobs start). */
  readonly fixed: Partial<Patch>;
  readonly generator: GeneratorSpec;
  /** Lowest and highest note, e.g. ['C3', 'C5']. */
  readonly noteRange: readonly [string, string];
  /** Rounds per run; defaults to DEFAULT_ROUNDS. */
  readonly rounds?: number;
  /** Average needed to pass; defaults to PASS_MARK. */
  readonly passMark?: number;
}

export interface Chapter {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly levels: readonly Level[];
}

/** A daily challenge tier: one shared target a day, using a level's controls and generator. */
export interface DailyTier {
  /** e.g. 'basics', 'full'. */
  readonly id: string;
  readonly title: string;
  /** Uses this level's controls and generator; available once the level is passed. */
  readonly levelId: string;
}

/** A factory sound a pack adds to the Free Play library. */
export interface Preset {
  /** Unique within the pack. */
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  /** Settings that differ from the defaults. */
  readonly patch: Partial<Patch>;
}

export interface PackRequirements {
  /** Packs to pass completely first. */
  readonly packs?: readonly string[];
  /** Engine modules the pack needs; it's hidden if the engine lacks one. */
  readonly engineModules?: readonly string[];
}

export interface Pack {
  /** e.g. 'foundations', 'bass', 'bass.dubstep'. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Bump when content changes; part of every replay code. */
  readonly version: number;
  readonly requires?: PackRequirements;
  /** Unlocked from the start of the pack. */
  readonly baseControls: readonly ParamId[];
  readonly chapters: readonly Chapter[];
  /** Daily challenge tiers this pack offers. */
  readonly daily?: readonly DailyTier[];
  /** Factory sounds added to the Free Play library (read-only there). */
  readonly presets?: readonly Preset[];
}
