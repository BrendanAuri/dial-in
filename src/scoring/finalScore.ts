/**
 * The round's final score. For now it's the parameter score less hint
 * penalties; Milestone 5 blends in the audio score.
 */
import { HINT_COST, STAR_SCORES } from '../engine/constants';

export interface RoundScore {
  /** 0–100, rounded, after hint penalties. */
  readonly score: number;
  readonly paramScore: number;
  readonly hintPenalty: number;
  /** 0–3. */
  readonly stars: number;
  readonly passed: boolean;
}

export function starsFor(score: number): number {
  return STAR_SCORES.filter((needed) => score >= needed).length;
}

export function finalScore(paramScore: number, hintsUsed: number, passMark: number): RoundScore {
  const hintPenalty = hintsUsed * HINT_COST;
  const score = Math.max(0, Math.round(paramScore) - hintPenalty);
  return { score, paramScore, hintPenalty, stars: starsFor(score), passed: score >= passMark };
}
