/**
 * Plain maths behind the voice's envelopes and LFO. voice.ts schedules Web
 * Audio automation; these functions describe the same curves as numbers, so
 * they can be tested without Web Audio and used to pick up an envelope
 * mid-flight on release.
 */
import {
  CENTS_PER_OCTAVE,
  CENTS_PER_SEMITONE,
  ENV_TIME_CONSTANTS_PER_SEGMENT,
  LFO_AMP_MAX_DEPTH,
  LFO_CUTOFF_DEPTH_OCTAVES,
  LFO_PITCH_DEPTH_SEMITONES,
} from './constants';
import type { LfoTarget } from './params';

export interface AmpEnvelope {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
}

/** setTargetAtTime time constant for an exponential segment lasting `segmentTime`. */
export function segmentTimeConstant(segmentTime: number): number {
  return segmentTime / ENV_TIME_CONSTANTS_PER_SEGMENT;
}

/**
 * Amp envelope level `t` seconds after note start, before release:
 * linear attack 0 → 1, then exponential decay towards sustain.
 */
export function ampEnvelopeValue(env: AmpEnvelope, t: number): number {
  if (t <= 0) return 0;
  if (t < env.attack) return t / env.attack;
  const sinceDecay = t - env.attack;
  return env.sustain + (1 - env.sustain) * Math.exp(-sinceDecay / segmentTimeConstant(env.decay));
}

/** Level `t` seconds into a release that started at `startLevel`. */
export function releaseValue(startLevel: number, release: number, t: number): number {
  if (t <= 0) return startLevel;
  return startLevel * Math.exp(-t / segmentTimeConstant(release));
}

/**
 * Peak of the filter envelope in octaves above cutoff, reduced so that
 * cutoff × 2^peak never exceeds `maxCutoff`.
 */
export function filterEnvPeakOctaves(cutoff: number, amount: number, maxCutoff: number): number {
  const headroom = Math.max(0, Math.log2(maxCutoff / cutoff));
  return Math.max(0, Math.min(amount, headroom));
}

export function octavesToCents(octaves: number): number {
  return octaves * CENTS_PER_OCTAVE;
}

/**
 * Gain applied to the raw ±1 LFO signal before it reaches its target:
 * cents of filter detune for cutoff, cents of osc detune for pitch, and
 * gain swing for amp. Off gives 0.
 */
export function lfoModulationAmount(target: LfoTarget, depth: number): number {
  switch (target) {
    case 'off':
      return 0;
    case 'cutoff':
      return depth * LFO_CUTOFF_DEPTH_OCTAVES * CENTS_PER_OCTAVE;
    case 'pitch':
      return depth * LFO_PITCH_DEPTH_SEMITONES * CENTS_PER_SEMITONE;
    case 'amp':
      return (depth * LFO_AMP_MAX_DEPTH) / 2;
  }
}

/**
 * Resting gain of the tremolo stage. With the amp LFO adding ±depth/2 on
 * top, gain swings between 1 − depth and 1.
 */
export function tremoloBaseGain(target: LfoTarget, depth: number): number {
  return target === 'amp' ? 1 - (depth * LFO_AMP_MAX_DEPTH) / 2 : 1;
}
