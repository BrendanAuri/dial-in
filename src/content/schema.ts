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

/**
 * How a level's targets are generated. Unlocked controls without an entry
 * use their full range (or every option).
 */
export interface GeneratorSpec {
  readonly params: { readonly [K in ParamId]?: ParamGenerator<K> };
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
  readonly rounds?: number;
  readonly passMark?: number;
}

export interface Chapter {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly levels: readonly Level[];
}

export interface Pack {
  /** e.g. 'foundations', 'bass', 'bass.dubstep'. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Bump when content changes; part of every replay code. */
  readonly version: number;
  /** Unlocked from the start of the pack. */
  readonly baseControls: readonly ParamId[];
  readonly chapters: readonly Chapter[];
}
