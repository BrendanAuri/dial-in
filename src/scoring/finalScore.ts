/**
 * The round's final score: the parameter score blended with the audio
 * score, lifted when the two sounds are practically identical, less hint
 * penalties.
 */
import { AUDIO_MATCH_FLOOR, AUDIO_MATCH_SCORE, AUDIO_SCORE_WEIGHT, HINT_COST, STAR_SCORES } from '../engine/constants';

export interface RoundScore {
  /** 0–100, rounded, after hint penalties. */
  readonly score: number;
  readonly paramScore: number;
  /** Null if the audio couldn't be rendered; the score is then the parameter score alone. */
  readonly audioScore: number | null;
  /** True when sounding the same as the target raised the score to AUDIO_MATCH_FLOOR. */
  readonly liftedBySound: boolean;
  readonly hintPenalty: number;
  /** 0–3. */
  readonly stars: number;
  readonly passed: boolean;
}

export function starsFor(score: number): number {
  return STAR_SCORES.filter((needed) => score >= needed).length;
}

export function finalScore(paramScore: number, audioScore: number | null, hintsUsed: number, passMark: number): RoundScore {
  const blended =
    audioScore === null ? paramScore : (1 - AUDIO_SCORE_WEIGHT) * paramScore + AUDIO_SCORE_WEIGHT * audioScore;
  const rounded = Math.round(blended);
  const liftedBySound = audioScore !== null && audioScore >= AUDIO_MATCH_SCORE && rounded < AUDIO_MATCH_FLOOR;
  const hintPenalty = hintsUsed * HINT_COST;
  const score = Math.max(0, (liftedBySound ? AUDIO_MATCH_FLOOR : rounded) - hintPenalty);
  return {
    score,
    paramScore,
    audioScore,
    liftedBySound,
    hintPenalty,
    stars: starsFor(score),
    passed: score >= passMark,
  };
}
