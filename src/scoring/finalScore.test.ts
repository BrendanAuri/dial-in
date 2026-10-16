import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH } from '../engine/patch';
import { finalScore, starsFor } from './finalScore';
import { scoreRound } from './scoreRound';

describe('finalScore', () => {
  it('awards stars at 80, 90 and 97', () => {
    expect([0, 79, 80, 89, 90, 96, 97, 100].map(starsFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('blends 70 % settings with 30 % sound', () => {
    expect(finalScore(80, 60, 0, 80).score).toBe(74);
    expect(finalScore(100, 0, 0, 80).score).toBe(70);
  });

  it('uses the settings score alone when there is no audio score', () => {
    expect(finalScore(84.6, null, 0, 80)).toEqual({
      score: 85,
      paramScore: 84.6,
      audioScore: null,
      liftedBySound: false,
      hintPenalty: 0,
      stars: 1,
      passed: true,
    });
  });

  it('lifts different settings that sound the same to at least 90', () => {
    const lifted = finalScore(70, 96, 0, 80);
    expect(lifted.score).toBe(90);
    expect(lifted.liftedBySound).toBe(true);
    expect(finalScore(70, 94, 0, 80).score).toBe(77);
    expect(finalScore(99, 99, 0, 80)).toMatchObject({ score: 99, liftedBySound: false });
  });

  it('takes off hint penalties after blending and never goes below zero', () => {
    expect(finalScore(70, 96, 1, 80)).toMatchObject({ score: 80, hintPenalty: 10, passed: true });
    expect(finalScore(84.6, null, 1, 80)).toMatchObject({ score: 75, stars: 0, passed: false });
    expect(finalScore(15, 10, 3, 80).score).toBe(0);
  });

  it('uses the level pass mark', () => {
    expect(finalScore(70, null, 0, 70).passed).toBe(true);
    expect(finalScore(70, null, 0, 71).passed).toBe(false);
  });
});

describe('scoreRound', () => {
  it('combines the score, audio, tips and the submitted sound', () => {
    const target = { ...DEFAULT_PATCH, 'filter.cutoff': 1000 };
    const mine = { ...DEFAULT_PATCH, 'filter.cutoff': 250 };
    const audio = { score: 40, parts: { loudness: 100, brightness: 0, timbre: 20 }, distances: { loudnessDb: 0, brightnessOctaves: 1, timbre: 40 } };
    const result = scoreRound({
      target,
      mine,
      unlocked: ['osc.wave', 'filter.cutoff'],
      context: { note: 48, holdTime: 1.5 },
      audio,
      hintsUsed: 0,
      passMark: 80,
    });
    expect(result.score.paramScore).toBe(50);
    expect(result.score.score).toBe(47);
    expect(result.audio).toBe(audio);
    expect(result.tips.map((tip) => tip.id)).toEqual(['filter.cutoff']);
    expect(result.mine).toEqual(mine);
    expect(result.mine).not.toBe(mine);
  });
});
