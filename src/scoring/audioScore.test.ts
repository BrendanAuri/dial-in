import { describe, expect, it } from 'vitest';
import { AUDIO_CALIBRATION, RENDER_SAMPLE_RATE } from '../engine/constants';
import type { FeatureFrames } from './audioFeatures';
import { audioScore, audioScoreFromDistances, compareFrames, partScore } from './audioScore';

const SR = RENDER_SAMPLE_RATE;
const SECONDS = 1;

/** A tone with partials at multiples of `hz`, amplitude falling as 1/n^`rolloff`, shaped by `envelope`. */
function tone(hz: number, partials: number, rolloff: number, envelope: (t: number) => number = () => 1): Float32Array {
  return Float32Array.from({ length: SR * SECONDS }, (_, i) => {
    const t = i / SR;
    let sum = 0;
    for (let n = 1; n <= partials; n++) sum += Math.sin(2 * Math.PI * hz * n * t) / n ** rolloff;
    return 0.3 * envelope(t) * sum;
  });
}

const bright = tone(220, 20, 1);
const dull = tone(220, 3, 2);

describe('audioScore', () => {
  it('scores identical audio 100', () => {
    expect(audioScore(bright, bright, SR).score).toBe(100);
  });

  it('ignores overall volume', () => {
    const quieter = bright.map((s) => s * 0.25);
    const result = audioScore(bright, quieter, SR);
    expect(result.distances.loudnessDb).toBeCloseTo(0, 3);
    expect(result.score).toBeCloseTo(100, 3);
  });

  it('notices brightness and timbre differences', () => {
    const result = audioScore(bright, dull, SR);
    expect(result.distances.brightnessOctaves).toBeGreaterThan(0.5);
    expect(result.parts.brightness).toBeLessThan(50);
    expect(result.score).toBeLessThan(70);
  });

  it('notices a different loudness shape', () => {
    const swell = tone(220, 20, 1, (t) => Math.min(1, t / 0.5));
    const result = audioScore(bright, swell, SR);
    expect(result.distances.loudnessDb).toBeGreaterThan(1);
    expect(result.parts.loudness).toBeLessThan(90);
  });

  it('scores two silent buffers 100', () => {
    const silence = new Float32Array(SR / 2);
    expect(audioScore(silence, silence, SR).score).toBe(100);
  });
});

describe('compareFrames', () => {
  const frame = (rms: number, centroidHz: number, mfcc: number[]): FeatureFrames => ({ rms: [rms], centroidHz: [centroidHz], mfcc: [mfcc] });

  it('treats sound against silence as completely different in brightness', () => {
    const loud = frame(0.1, 1000, [10, 1, 1]);
    const silent = frame(0, 0, [0, 0, 0]);
    const d = compareFrames(loud, silent);
    expect(d.brightnessOctaves).toBe(AUDIO_CALIBRATION.brightnessOctaves.zero);
    expect(d.timbre).toBeCloseTo(Math.sqrt(102));
    expect(d.loudnessDb).toBeGreaterThan(20);
  });

  it('compares centroids in octaves', () => {
    expect(compareFrames(frame(0.1, 500, [1]), frame(0.1, 2000, [1])).brightnessOctaves).toBeCloseTo(2);
  });

  it('skips frames where both sides are silent', () => {
    expect(compareFrames(frame(0, 0, [0]), frame(0, 0, [0]))).toEqual({ loudnessDb: 0, brightnessOctaves: 0, timbre: 0 });
  });
});

describe('partScore', () => {
  const cal = { perfect: 1, zero: 5 };

  it('is 100 up to perfect, 0 from zero, linear between', () => {
    expect(partScore(0, cal)).toBe(100);
    expect(partScore(1, cal)).toBe(100);
    expect(partScore(3, cal)).toBe(50);
    expect(partScore(5, cal)).toBe(0);
    expect(partScore(50, cal)).toBe(0);
  });

  it('averages the three parts', () => {
    const result = audioScoreFromDistances({ loudnessDb: 0, brightnessOctaves: 0, timbre: 1000 });
    expect(result.score).toBeCloseTo(200 / 3);
  });
});
