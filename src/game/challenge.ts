/**
 * Challenges: a sound turned into a round. The solver gets the controls the
 * creator chose, starting at their defaults; everything else is set as in
 * the sound and shown locked.
 */
import { DEFAULT_HOLD_TIME, TIP_CLOSENESS } from '../engine/constants';
import { PARAM_IDS, type ParamId, type Patch } from '../engine/params';
import { DEFAULT_PATCH, patchFromRecord } from '../engine/patch';
import { isAudible, type ListeningContext } from '../scoring/audible';
import { starsFor } from '../scoring/finalScore';
import { paramDistance } from '../scoring/paramScore';
import type { Challenge } from './shareCode';

export interface ChallengeRound {
  readonly note: number;
  /** The solver's controls at their defaults; everything else as in the sound. */
  readonly start: Patch;
  readonly target: Patch;
  /** The solver's controls, in display order. */
  readonly unlocked: readonly ParamId[];
}

function contextFor(note: number): ListeningContext {
  return { note, holdTime: DEFAULT_HOLD_TIME };
}

export function challengeRound(challenge: Pick<Challenge, 'patch' | 'controls' | 'note'>): ChallengeRound {
  const unlocked = PARAM_IDS.filter((id) => challenge.controls.includes(id));
  const reset = Object.fromEntries(unlocked.map((id) => [id, DEFAULT_PATCH[id]]));
  return {
    note: challenge.note,
    start: patchFromRecord({ ...challenge.patch, ...reset }),
    target: challenge.patch,
    unlocked,
  };
}

/** The controls to offer by default: the ones the sound moves away from their defaults that can be heard on this note. */
export function suggestedControls(patch: Readonly<Patch>, note: number): ParamId[] {
  const context = contextFor(note);
  return PARAM_IDS.filter((id) => patch[id] !== DEFAULT_PATCH[id] && isAudible(id, patch, context));
}

/**
 * Whether there's something to match: at least one of the solver's controls
 * can be heard and starts far enough off to earn a tip.
 */
export function isPlayableChallenge(challenge: Pick<Challenge, 'patch' | 'controls' | 'note'>): boolean {
  const round = challengeRound(challenge);
  const context = contextFor(round.note);
  return round.unlocked.some(
    (id) => isAudible(id, round.target, context) && paramDistance(id, round.start, round.target) > 1 - TIP_CLOSENESS,
  );
}

// ── Share texts (spoiler-free: names and scores, never settings) ─────────

/** "92 ★★": the score, with stars if it earned any. */
function scoreWithStars(score: number): string {
  const stars = starsFor(score);
  return stars > 0 ? `${score} ${'★'.repeat(stars)}` : `${score}`;
}

export function soundInviteText(name: string): string {
  return `"${name}": a sound made in Dial In.`;
}

export function challengeInviteText(name: string, controls: number): string {
  return `Can you match "${name}"? A Dial In challenge with ${controls} ${controls === 1 ? 'control' : 'controls'}.`;
}

export function challengeResultText(name: string, best: number): string {
  return `Dial In challenge "${name}" · ${scoreWithStars(best)}. Can you beat it?`;
}
