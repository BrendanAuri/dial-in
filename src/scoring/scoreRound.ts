/** Everything the result card shows for one submitted attempt. */
import type { ParamId, Patch } from '../engine/params';
import type { ListeningContext } from './audible';
import { buildTips, type Tip } from './feedback';
import { finalScore, type RoundScore } from './finalScore';
import { scoreParams, type ParamScore } from './paramScore';

export interface RoundResult {
  readonly score: RoundScore;
  readonly params: ParamScore;
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
  readonly hintsUsed: number;
  readonly passMark: number;
}

export function scoreRound(input: RoundInput): RoundResult {
  const params = scoreParams(input.target, input.mine, input.unlocked, input.context);
  return {
    score: finalScore(params.score, input.hintsUsed, input.passMark),
    params,
    tips: buildTips(params, input.mine, input.target),
    mine: { ...input.mine },
  };
}
