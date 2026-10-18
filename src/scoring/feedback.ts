/**
 * Plain-language feedback: for each control that's noticeably off, say
 * which way and roughly how far, and what you'd hear. Also hints, which
 * name the furthest-off control and a direction but never a value.
 */
import { INSTANT_ATTACK, TIP_CLOSENESS } from '../engine/constants';
import { lfoRateHz } from '../engine/modulation';
import { controlName, PARAMS, type LfoSync, type LfoTarget, type ParamId, type Patch, type Waveform } from '../engine/params';
import { effectiveLfoTarget } from './audible';
import { impact, type ParamScore } from './paramScore';

export interface Tip {
  readonly id: ParamId;
  readonly text: string;
  /** weight × (1 − closeness): how much this control cost the score. */
  readonly impact: number;
}

const WAVE_SOUNDS: Readonly<Record<Waveform, string>> = {
  sine: 'pure, no harmonics',
  triangle: 'soft, with faint odd harmonics',
  saw: 'bright and buzzy, every harmonic',
  square: 'hollow, odd harmonics only',
};

const LFO_MOVES: Readonly<Record<Exclude<LfoTarget, 'off'>, string>> = {
  cutoff: 'brightness (cutoff)',
  pitch: 'pitch (vibrato)',
  amp: 'volume (tremolo)',
};

/** "slightly", "about half an octave", "about 1 octave", "about 1.5 octaves"… */
function octaveSize(octaves: number): string {
  const size = Math.abs(octaves);
  if (size < 0.4) return 'slightly';
  const halves = Math.round(size * 2) / 2;
  if (halves === 0.5) return 'about half an octave';
  return `about ${halves} ${halves === 1 ? 'octave' : 'octaves'}`;
}

/** "a bit ", "", "much " for a difference in octaves (times, rates). */
function ratioSize(octaves: number): string {
  const size = Math.abs(octaves);
  if (size < 1) return 'a bit ';
  if (size < 2.5) return '';
  return 'much ';
}

/** "a bit ", "", "much " for a linear difference as a fraction of the range. */
function linearSize(id: ParamId, mine: number, target: number): string {
  const def = PARAMS[id];
  const range = def.kind === 'continuous' ? def.max - def.min : 1;
  const fraction = Math.abs(mine - target) / range;
  if (fraction < 0.15) return 'a bit ';
  if (fraction < 0.45) return '';
  return 'much ';
}

function syncName(sync: LfoSync): string {
  return PARAMS['lfo.sync'].options.find((option) => option.value === sync)?.label ?? sync;
}

/** How much faster your LFO moves than the target's, in octaves (negative: slower). */
function lfoSpeedOctaves(mine: Readonly<Patch>, target: Readonly<Patch>): number {
  return Math.log2(lfoRateHz(mine) / lfoRateHz(target));
}

function waveName(wave: Waveform): string {
  return PARAMS['osc.wave'].options.find((option) => option.value === wave)?.label.toLowerCase() ?? wave;
}

/** The tip text for one control. Assumes the two values differ noticeably. */
export function tipText(id: ParamId, mine: Readonly<Patch>, target: Readonly<Patch>): string {
  const name = controlName(id);
  switch (id) {
    case 'osc.wave':
      return `${name}: you used ${waveName(mine[id])} (${WAVE_SOUNDS[mine[id]]}); the target is ${waveName(target[id])} (${WAVE_SOUNDS[target[id]]}).`;
    case 'osc.octave': {
      const diff = mine[id] - target[id];
      const size = Math.abs(diff) === 1 ? 'one octave' : 'two octaves';
      return `${name}: yours is ${size} too ${diff > 0 ? 'high' : 'low'}.`;
    }
    case 'filter.cutoff': {
      const octaves = Math.log2(mine[id] / target[id]);
      return octaves < 0
        ? `${name}: ${octaveSize(octaves)} too low, so your sound is darker than the target.`
        : `${name}: ${octaveSize(octaves)} too high, so your sound is brighter than the target.`;
    }
    case 'filter.resonance': {
      const size = linearSize(id, mine[id], target[id]);
      return mine[id] < target[id]
        ? `${name}: ${size}too low. The target has a stronger, ringing peak at the cutoff.`
        : `${name}: ${size}too high. Yours rings at the cutoff more than the target does.`;
    }
    case 'amp.attack': {
      const octaves = Math.log2(mine[id] / target[id]);
      if (octaves > 0) {
        const how = target[id] < INSTANT_ATTACK ? 'The target starts instantly.' : 'The target starts sooner.';
        return `${name}: ${ratioSize(octaves)}too slow. ${how}`;
      }
      return `${name}: ${ratioSize(octaves)}too fast. The target fades in more gradually.`;
    }
    case 'amp.decay': {
      const octaves = Math.log2(mine[id] / target[id]);
      return octaves > 0
        ? `${name}: ${ratioSize(octaves)}too long. The target settles to its sustain level more quickly.`
        : `${name}: ${ratioSize(octaves)}too short. The target takes longer to settle to its sustain level.`;
    }
    case 'amp.sustain': {
      const size = linearSize(id, mine[id], target[id]);
      if (mine[id] > target[id]) {
        const how = target[id] < 0.05 ? 'The target fades away completely while the note is held.' : 'The target drops to a quieter level while held.';
        return `${name}: ${size}too high. ${how}`;
      }
      return `${name}: ${size}too low. The target stays louder while the note is held.`;
    }
    case 'amp.release': {
      const octaves = Math.log2(mine[id] / target[id]);
      return octaves > 0
        ? `${name}: ${ratioSize(octaves)}too long. The target stops more quickly after the note ends.`
        : `${name}: ${ratioSize(octaves)}too short. The target keeps fading out after the note ends.`;
    }
    case 'fenv.amount': {
      const size = linearSize(id, mine[id], target[id]);
      return mine[id] < target[id]
        ? `${name}: ${size}too low. The target starts brighter and closes down, a pluckier sound.`
        : `${name}: ${size}too high. Yours sweeps down from brighter than the target does.`;
    }
    case 'fenv.decay': {
      const octaves = Math.log2(mine[id] / target[id]);
      return octaves > 0
        ? `${name}: ${ratioSize(octaves)}too long. The target's brightness closes down faster.`
        : `${name}: ${ratioSize(octaves)}too short. The target's brightness closes down more slowly.`;
    }
    case 'lfo.target': {
      const theirs = effectiveLfoTarget(target);
      const yours = effectiveLfoTarget(mine);
      if (theirs === 'off') return `${name}: the target doesn't move; yours wobbles its ${yours === 'off' ? 'sound' : LFO_MOVES[yours]}.`;
      if (mine['lfo.target'] === 'off') return `${name}: the target wobbles its ${LFO_MOVES[theirs]}; yours has the LFO off.`;
      return `${name}: the target wobbles its ${LFO_MOVES[theirs]}, not its ${LFO_MOVES[mine['lfo.target']]}.`;
    }
    case 'lfo.rate': {
      const octaves = lfoSpeedOctaves(mine, target);
      const synced = mine['lfo.sync'] === 'off' ? '' : ' Yours is synced to the tempo: set Sync to Off to use Rate.';
      return octaves > 0
        ? `${name}: ${ratioSize(octaves)}too fast. The target's movement is slower.${synced}`
        : `${name}: ${ratioSize(octaves)}too slow. The target's movement is faster.${synced}`;
    }
    case 'lfo.sync': {
      const octaves = lfoSpeedOctaves(mine, target);
      const speed = octaves > 0 ? 'faster' : 'slower';
      return mine[id] === 'off'
        ? `${name}: the target is synced to ${syncName(target[id])}. Yours runs free in Hz and moves ${ratioSize(octaves)}${speed}.`
        : `${name}: yours is ${syncName(mine[id])} and the target is ${syncName(target[id])}, so yours moves ${speed}.`;
    }
    case 'lfo.tempo':
      return `${name}: yours is ${Math.round(mine[id])} BPM; the target is ${Math.round(target[id])} BPM.`;
    case 'lfo.depth': {
      const size = linearSize(id, mine[id], target[id]);
      return mine[id] > target[id]
        ? `${name}: ${size}too deep. The target moves less.`
        : `${name}: ${size}too shallow. The target's movement is stronger.`;
    }
    case 'osc2.detune': {
      const size = linearSize(id, mine[id], target[id]);
      if (mine[id] > target[id]) {
        return target[id] === 0
          ? `${name}: too much. The target has no detune: one steady tone.`
          : `${name}: ${size}too much. Yours beats faster and sounds wider than the target.`;
      }
      return `${name}: ${size}too little. The target is thicker, with faster beating between the two oscillators.`;
    }
    case 'noise.level': {
      const size = linearSize(id, mine[id], target[id]);
      return mine[id] > target[id]
        ? `${name}: ${size}too much. Yours is hissier than the target.`
        : `${name}: ${size}too little. The target has more hiss or breath.`;
    }
    case 'sub.level': {
      const size = linearSize(id, mine[id], target[id]);
      if (mine[id] > target[id]) {
        return target[id] === 0
          ? `${name}: too much. The target has no sub.`
          : `${name}: ${size}too much. Yours has more low-end weight than the target.`;
      }
      return `${name}: ${size}too little. The target has a deeper, heavier low end. Headphones help here.`;
    }
    case 'drive.amount': {
      const size = linearSize(id, mine[id], target[id]);
      if (mine[id] > target[id]) {
        return target[id] === 0
          ? `${name}: too much. The target is clean, with no distortion.`
          : `${name}: ${size}too much. Yours is grittier and more distorted than the target.`;
      }
      return `${name}: ${size}too little. The target is dirtier, with more harmonics and grit.`;
    }
  }
}

/** Tips for every scored control that's noticeably off, biggest cost to the score first. */
export function buildTips(result: ParamScore, mine: Readonly<Patch>, target: Readonly<Patch>): Tip[] {
  return result.controls
    .filter((control) => control.inaudible === null && control.closeness < TIP_CLOSENESS)
    .map((control) => ({ id: control.id, text: tipText(control.id, mine, target), impact: impact(control) }))
    .sort((a, b) => b.impact - a.impact);
}

/** A control name for the middle of a sentence: "Cutoff" → "cutoff", but "LFO rate" stays. */
function midSentence(name: string): string {
  const first = name.split(' ')[0] ?? '';
  return first === first.toUpperCase() ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** Which way to move a control to get closer, in words, without giving the value. */
function hintDirection(id: ParamId, mine: Readonly<Patch>, target: Readonly<Patch>): string {
  const name = midSentence(controlName(id));
  switch (id) {
    case 'osc.wave':
      return 'Try a different waveform.';
    case 'osc.octave':
      return `Try a ${mine[id] < target[id] ? 'higher' : 'lower'} octave.`;
    case 'lfo.target':
      return effectiveLfoTarget(target) === 'off' ? 'Listen again: does the target move at all?' : `Try a different ${name}.`;
    case 'lfo.sync':
      return `Try a ${lfoSpeedOctaves(mine, target) < 0 ? 'faster' : 'slower'} ${name} setting.`;
    case 'lfo.rate':
      return `Try turning ${name} ${lfoSpeedOctaves(mine, target) < 0 ? 'up' : 'down'}.`;
    default:
      return `Try turning ${name} ${mine[id] < target[id] ? 'up' : 'down'}.`;
  }
}

/** A hint for the scored control that's costing the most, or a nudge if everything's close. */
export function hintFor(result: ParamScore, mine: Readonly<Patch>, target: Readonly<Patch>): string {
  const worst = result.controls
    .filter((control) => control.inaudible === null && control.closeness < 1)
    .sort((a, b) => impact(b) - impact(a))[0];
  if (!worst) return "Everything's spot on. Submit it!";
  return hintDirection(worst.id, mine, target);
}
