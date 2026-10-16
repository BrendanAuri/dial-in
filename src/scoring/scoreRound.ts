/** Everything the result card shows for one submitted attempt. */
import type { ParamId, Patch } from '../engine/params';
import type { ListeningContext } from './audible';
import type { AudioScore } from './audioScore';
import { buildTips, type Tip } from './feedback';
import { finalScore, type RoundScore } from './finalScore';
import { scoreParams, type ParamScore } from './paramScore';

export interface RoundResult {
  readonly score: RoundScore;
  readonly params: ParamScore;
  /** Null if the audio couldn't be rendered. */
  readonly audio: AudioScore | null;
  /** Every tip, biggest cost to the score first. */
  readonly tips: readonly Tip[];
  /** The sound that was submitted. */
  readonly mine: Patch;
}

export interface RoundInput {
  readonly target: Readonly<Patch>;
  readonly mine: Readonly<Patch>;
  readonly unlocked: readonly ParamId[];
  readonly context: ListeningContext;
  readonly audio: AudioScore | null;
  readonly hintsUsed: number;
  readonly passMark: number;
}

export function scoreRound(input: RoundInput): RoundResult {
  const params = scoreParams(input.target, input.mine, input.unlocked, input.context);
  return {
    score: finalScore(params.score, input.audio?.score ?? null, input.hintsUsed, input.passMark),
    params,
    audio: input.audio,
    tips: buildTips(params, input.mine, input.target),
    mine: { ...input.mine },
  };
}
