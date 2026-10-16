/**
 * Audibility rules: a control that can't be heard in the target isn't
 * scored, so players aren't marked down for settings nobody could hear.
 */
import {
  FILTER_ENV_MIN_AUDIBLE_OCTAVES,
  LFO_MIN_AUDIBLE_DEPTH,
  RELEASE_MIN_AUDIBLE_LEVEL,
  RESONANCE_AUDIBLE_MAX_CUTOFF,
  SEMITONES_PER_OCTAVE,
  SUSTAIN_FULL,
  WAVEFORM_MIN_CUTOFF_RATIO,
} from '../engine/constants';
import { ampEnvelopeValue, filterEnvPeakOctaves } from '../engine/modulation';
import { midiToHz } from '../engine/notes';
import { PARAMS, type LfoTarget, type ParamId, type Patch } from '../engine/params';

/** What the round plays: needed for rules that depend on pitch or note length. */
export interface ListeningContext {
  readonly note: number;
  readonly holdTime: number;
}

const MAX_CUTOFF = PARAMS['filter.cutoff'].max;

/** The LFO target as heard: 'off' when the depth is too small to notice. */
export function effectiveLfoTarget(patch: Readonly<Patch>): LfoTarget {
  return patch['lfo.depth'] < LFO_MIN_AUDIBLE_DEPTH ? 'off' : patch['lfo.target'];
}

/** How far the filter envelope actually opens the cutoff, in octaves. */
export function filterEnvOctaves(patch: Readonly<Patch>): number {
  return filterEnvPeakOctaves(patch['filter.cutoff'], patch['fenv.amount'], MAX_CUTOFF);
}

function fundamentalHz(patch: Readonly<Patch>, note: number): number {
  return midiToHz(note + patch['osc.octave'] * SEMITONES_PER_OCTAVE);
}

/** Why a control can't be heard in `target`, or null if it can. */
export function inaudibleReason(id: ParamId, target: Readonly<Patch>, context: ListeningContext): string | null {
  const attackOutlastsNote = target['amp.attack'] >= context.holdTime;
  const lfoOff = effectiveLfoTarget(target) === 'off';
  switch (id) {
    case 'osc.wave': {
      const brightest = target['filter.cutoff'] * 2 ** filterEnvOctaves(target);
      return brightest <= fundamentalHz(target, context.note) * WAVEFORM_MIN_CUTOFF_RATIO
        ? 'The cutoff is so low that every waveform sounds like a sine.'
        : null;
    }
    case 'filter.resonance':
      return target['filter.cutoff'] >= RESONANCE_AUDIBLE_MAX_CUTOFF
        ? "The cutoff is near the top, so resonance can't be heard."
        : null;
    case 'fenv.amount':
      return Math.log2(MAX_CUTOFF / target['filter.cutoff']) < FILTER_ENV_MIN_AUDIBLE_OCTAVES
        ? 'The cutoff is at the top, so the filter envelope has nowhere to go.'
        : null;
    case 'fenv.decay':
      return filterEnvOctaves(target) < FILTER_ENV_MIN_AUDIBLE_OCTAVES ? "The filter envelope isn't moving the cutoff." : null;
    case 'amp.decay':
      if (attackOutlastsNote) return 'The attack lasts the whole note, so the decay never starts.';
      return target['amp.sustain'] >= SUSTAIN_FULL ? "Sustain is full, so there's no decay to hear." : null;
    case 'amp.sustain':
      return attackOutlastsNote ? 'The attack lasts the whole note, so the sustain level is never reached.' : null;
    case 'amp.release': {
      const env = { attack: target['amp.attack'], decay: target['amp.decay'], sustain: target['amp.sustain'] };
      return ampEnvelopeValue(env, context.holdTime) < RELEASE_MIN_AUDIBLE_LEVEL
        ? "The note has faded out before it's released."
        : null;
    }
    case 'lfo.rate':
    case 'lfo.depth':
      return lfoOff ? "The target's LFO isn't moving anything." : null;
    case 'osc.octave':
    case 'osc2.detune':
    case 'noise.level':
    case 'filter.cutoff':
    case 'amp.attack':
    case 'lfo.target':
      return null;
  }
}

export function isAudible(id: ParamId, target: Readonly<Patch>, context: ListeningContext): boolean {
  return inaudibleReason(id, target, context) === null;
}
