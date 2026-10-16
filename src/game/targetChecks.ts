/**
 * Quick checks the generator uses to reject unfair targets: ones that are
 * (nearly) silent or too short to judge, and ones too close to where the
 * knobs start. Rough maths on the patch, no audio rendering.
 */
import {
  FILTER_SLOPE_DB_PER_OCTAVE,
  LOUDNESS_STEP_SECONDS,
  SEMITONES_PER_OCTAVE,
  TARGET_AUDIBLE_LEVEL,
} from '../engine/constants';
import { ampEnvelopeValue, filterEnvPeakOctaves, releaseValue, segmentTimeConstant } from '../engine/modulation';
import { midiToHz } from '../engine/notes';
import { PARAMS, isContinuousId, type ParamId, type Patch } from '../engine/params';
import { toNormalised } from '../engine/scale';

export interface LoudnessEstimate {
  /** Loudest moment of the note's fundamental, in dB (0 = full level). */
  readonly peakDb: number;
  /** How long it stays above TARGET_AUDIBLE_LEVEL, in seconds. */
  readonly audibleSeconds: number;
}

/**
 * Estimate how loud and how long the note's fundamental is, from the amp
 * envelope and a rough lowpass slope (including the filter envelope).
 * Ignores resonance and the LFO, so it errs on the quiet side.
 */
export function estimateLoudness(patch: Readonly<Patch>, note: number, holdTime: number): LoudnessEstimate {
  const fundamental = midiToHz(note + patch['osc.octave'] * SEMITONES_PER_OCTAVE);
  const env = { attack: patch['amp.attack'], decay: patch['amp.decay'], sustain: patch['amp.sustain'] };
  const releaseStart = ampEnvelopeValue(env, holdTime);
  const peakOctaves = filterEnvPeakOctaves(patch['filter.cutoff'], patch['fenv.amount'], PARAMS['filter.cutoff'].max);
  const filterTau = segmentTimeConstant(patch['fenv.decay']);
  const end = holdTime + patch['amp.release'];

  let peak = 0;
  let audibleSteps = 0;
  for (let t = 0; t <= end; t += LOUDNESS_STEP_SECONDS) {
    const amp = t < holdTime ? ampEnvelopeValue(env, t) : releaseValue(releaseStart, patch['amp.release'], t - holdTime);
    const cutoff = patch['filter.cutoff'] * 2 ** (peakOctaves * Math.exp(-t / filterTau));
    const filterDb = fundamental > cutoff ? -FILTER_SLOPE_DB_PER_OCTAVE * Math.log2(fundamental / cutoff) : 0;
    const level = amp * 10 ** (filterDb / 20);
    peak = Math.max(peak, level);
    if (level >= TARGET_AUDIBLE_LEVEL) audibleSteps++;
  }
  return {
    peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
    audibleSeconds: audibleSteps * LOUDNESS_STEP_SECONDS,
  };
}

/** How far one control is from another value, as a 0–1 knob position (discrete: 0 or 1). */
export function controlDistance(id: ParamId, a: Readonly<Patch>, b: Readonly<Patch>): number {
  if (isContinuousId(id)) {
    const def = PARAMS[id];
    return Math.abs(toNormalised(def, a[id]) - toNormalised(def, b[id]));
  }
  return a[id] === b[id] ? 0 : 1;
}

/** The largest distance between two patches across `ids`. */
export function maxDistance(ids: readonly ParamId[], a: Readonly<Patch>, b: Readonly<Patch>): number {
  return ids.reduce((max, id) => Math.max(max, controlDistance(id, a, b)), 0);
}
