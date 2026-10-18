/**
 * The parameter score: how close each audible control is to the target,
 * on a perceptual scale, combined into a weighted 0–100 score.
 */
import { SCORE_DEADBAND, SCORE_TOLERANCE, SCORE_WEIGHTS } from '../engine/constants';
import { lfoRateHz } from '../engine/modulation';
import { PARAMS, isContinuousId, type ParamId, type Patch } from '../engine/params';
import { effectiveLfoTarget, inaudibleReason, type ListeningContext } from './audible';

/**
 * Distance between your value and the target's, where 1 means "as far off
 * as the tolerance allows". Log controls compare in octaves, linear ones as
 * a fraction of the range, choices are 0 (same) or 1 (different). LFO
 * rate and sync both compare the speed you hear, in octaves, so a free
 * rate that matches a synced one counts as a match.
 */
export function paramDistance(id: ParamId, mine: Readonly<Patch>, target: Readonly<Patch>): number {
  if (id === 'lfo.rate' || id === 'lfo.sync') {
    return Math.abs(Math.log2(lfoRateHz(mine) / lfoRateHz(target))) / SCORE_TOLERANCE['lfo.rate'];
  }
  if (id === 'lfo.target') {
    // If the target has no audible LFO, all that matters is whether yours moves.
    if (effectiveLfoTarget(target) === 'off') return effectiveLfoTarget(mine) === 'off' ? 0 : 1;
    return mine['lfo.target'] === target['lfo.target'] ? 0 : 1;
  }
  if (!isContinuousId(id)) return mine[id] === target[id] ? 0 : 1;
  const def = PARAMS[id];
  const tolerance = SCORE_TOLERANCE[id];
  if (def.scale === 'log') return Math.abs(Math.log2(mine[id] / target[id])) / tolerance;
  const difference = Math.max(0, Math.abs(mine[id] - target[id]) - (SCORE_DEADBAND[id] ?? 0));
  return difference / ((def.max - def.min) * tolerance);
}

/** 1 for a perfect match, falling to 0 at the tolerance. */
export function closeness(id: ParamId, mine: Readonly<Patch>, target: Readonly<Patch>): number {
  return Math.max(0, 1 - paramDistance(id, mine, target));
}

export interface ControlScore {
  readonly id: ParamId;
  readonly closeness: number;
  readonly weight: number;
  /** Why the control isn't scored, or null if it is. */
  readonly inaudible: string | null;
}

export interface ParamScore {
  /** 0–100, unrounded. */
  readonly score: number;
  /** One entry per unlocked control, in display order. */
  readonly controls: readonly ControlScore[];
}

/** How much a control costs the score: weight × (1 − closeness). */
export function impact(control: ControlScore): number {
  return control.weight * (1 - control.closeness);
}

export function scoreParams(
  target: Readonly<Patch>,
  mine: Readonly<Patch>,
  unlocked: readonly ParamId[],
  context: ListeningContext,
): ParamScore {
  const controls = unlocked.map((id) => ({
    id,
    closeness: closeness(id, mine, target),
    weight: SCORE_WEIGHTS[id],
    inaudible: inaudibleReason(id, target, context),
  }));
  const scored = controls.filter((control) => control.inaudible === null);
  const totalWeight = scored.reduce((sum, control) => sum + control.weight, 0);
  const weighted = scored.reduce((sum, control) => sum + control.weight * control.closeness, 0);
  return { score: totalWeight === 0 ? 100 : (100 * weighted) / totalWeight, controls };
}
