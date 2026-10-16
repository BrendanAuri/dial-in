import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH } from '../engine/patch';
import { finalScore, starsFor } from './finalScore';
import { scoreRound } from './scoreRound';

describe('finalScore', () => {
  it('awards stars at 80, 90 and 97', () => {
    expect([0, 79, 80, 89, 90, 96, 97, 100].map(starsFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('rounds, takes off hint penalties and never goes below zero', () => {
    expect(finalScore(84.6, 0, 80)).toEqual({ score: 85, paramScore: 84.6, hintPenalty: 0, stars: 1, passed: true });
    expect(finalScore(84.6, 1, 80)).toMatchObject({ score: 75, hintPenalty: 10, stars: 0, passed: false });
    expect(finalScore(15, 3, 80).score).toBe(0);
  });

  it('uses the level pass mark', () => {
    expect(finalScore(70, 0, 70).passed).toBe(true);
    expect(finalScore(70, 0, 71).passed).toBe(false);
  });
});

describe('scoreRound', () => {
  it('combines the score, tips and the submitted sound', () => {
    const target = { ...DEFAULT_PATCH, 'filter.cutoff': 1000 };
    const mine = { ...DEFAULT_PATCH, 'filter.cutoff': 250 };
    const result = scoreRound({
      target,
      mine,
      unlocked: ['osc.wave', 'filter.cutoff'],
      context: { note: 48, holdTime: 1.5 },
      hintsUsed: 0,
      passMark: 80,
    });
    expect(result.score.score).toBe(50);
    expect(result.tips.map((tip) => tip.id)).toEqual(['filter.cutoff']);
    expect(result.mine).toEqual(mine);
    expect(result.mine).not.toBe(mine);
  });
});
