/**
 * Patch defaults, validation and versioned (de)serialisation.
 *
 * Serialised form: { v, params } with every parameter stored explicitly.
 * On load, missing parameters take their defaults, out-of-range values are
 * clamped and unknown parameters are dropped.
 */
import { PATCH_FORMAT_VERSION } from './constants';
import {
  CONTINUOUS_PARAM_IDS,
  PARAMS,
  PARAM_IDS,
  type DiscreteOption,
  type ParamId,
  type Patch,
} from './params';
import { clampToRange } from './scale';

export interface SerialisedPatch {
  readonly v: number;
  readonly params: Readonly<Record<string, number | string>>;
}

/** The starting patch: every parameter at its schema default. */
export const DEFAULT_PATCH: Readonly<Patch> = Object.freeze({
  'osc.wave': PARAMS['osc.wave'].default,
  'osc.octave': PARAMS['osc.octave'].default,
  'osc2.detune': PARAMS['osc2.detune'].default,
  'noise.level': PARAMS['noise.level'].default,
  'filter.cutoff': PARAMS['filter.cutoff'].default,
  'filter.resonance': PARAMS['filter.resonance'].default,
  'fenv.amount': PARAMS['fenv.amount'].default,
  'fenv.decay': PARAMS['fenv.decay'].default,
  'amp.attack': PARAMS['amp.attack'].default,
  'amp.decay': PARAMS['amp.decay'].default,
  'amp.sustain': PARAMS['amp.sustain'].default,
  'amp.release': PARAMS['amp.release'].default,
  'lfo.target': PARAMS['lfo.target'].default,
  'lfo.rate': PARAMS['lfo.rate'].default,
  'lfo.depth': PARAMS['lfo.depth'].default,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickOption<V>(options: readonly DiscreteOption<V>[], raw: unknown): V | undefined {
  return options.find((option) => option.value === raw)?.value;
}

/**
 * Build a valid patch from loosely typed values. Anything missing or invalid
 * comes from `fallback`; numbers are clamped into range.
 */
export function patchFromRecord(record: Readonly<Record<string, unknown>>, fallback: Readonly<Patch> = DEFAULT_PATCH): Patch {
  const patch: Patch = { ...fallback };
  for (const id of CONTINUOUS_PARAM_IDS) {
    const raw = record[id];
    if (typeof raw === 'number' && Number.isFinite(raw)) patch[id] = clampToRange(PARAMS[id], raw);
  }
  patch['osc.wave'] = pickOption(PARAMS['osc.wave'].options, record['osc.wave']) ?? fallback['osc.wave'];
  patch['osc.octave'] = pickOption(PARAMS['osc.octave'].options, record['osc.octave']) ?? fallback['osc.octave'];
  patch['lfo.target'] = pickOption(PARAMS['lfo.target'].options, record['lfo.target']) ?? fallback['lfo.target'];
  return patch;
}

/** Return a copy of `patch` with one parameter changed. Invalid values are ignored; numbers are clamped. */
export function setParam(patch: Readonly<Patch>, id: ParamId, value: unknown): Patch {
  return patchFromRecord({ [id]: value }, patch);
}

export function serialisePatch(patch: Readonly<Patch>): SerialisedPatch {
  return {
    v: PATCH_FORMAT_VERSION,
    params: Object.fromEntries(PARAM_IDS.map((id) => [id, patch[id]])),
  };
}

/** Read a serialised patch. Returns null if `data` isn't shaped like one at all. */
export function deserialisePatch(data: unknown): Patch | null {
  if (!isRecord(data) || typeof data.v !== 'number' || !isRecord(data.params)) return null;
  return patchFromRecord(data.params);
}

export function patchToJson(patch: Readonly<Patch>): string {
  return JSON.stringify(serialisePatch(patch));
}

/** Parse JSON from patchToJson. Returns null for invalid JSON or a non-patch. */
export function patchFromJson(json: string): Patch | null {
  try {
    return deserialisePatch(JSON.parse(json));
  } catch {
    return null;
  }
}
