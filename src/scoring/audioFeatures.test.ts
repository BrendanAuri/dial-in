import Meyda from 'meyda';
import { describe, expect, it } from 'vitest';
import { FEATURE_BUFFER_SIZE, MFCC_COEFFICIENTS, RENDER_SAMPLE_RATE } from '../engine/constants';
import { createRng } from '../game/rng';
import { extractFrames, frameFeatures, rmsOf, scaleToRms } from './audioFeatures';

const SR = RENDER_SAMPLE_RATE;

function tone(length: number, partials: readonly [hz: number, amp: number][], seed = 1, noise = 0): Float32Array {
  const rng = createRng(seed);
  return Float32Array.from({ length }, (_, i) =>
    partials.reduce((sum, [hz, amp]) => sum + amp * Math.sin((2 * Math.PI * hz * i) / SR), 0) + noise * (rng() * 2 - 1),
  );
}

const FRAMES: readonly [string, Float32Array][] = [
  ['sine', tone(FEATURE_BUFFER_SIZE, [[220, 0.5]])],
  ['harmonics', tone(FEATURE_BUFFER_SIZE, [[110, 0.4], [220, 0.2], [330, 0.13], [440, 0.1], [550, 0.08]])],
  ['noisy', tone(FEATURE_BUFFER_SIZE, [[880, 0.2]], 7, 0.3)],
  ['quiet', tone(FEATURE_BUFFER_SIZE, [[60, 0.001]])],
];

describe('frameFeatures matches Meyda', () => {
  Meyda.bufferSize = FEATURE_BUFFER_SIZE;
  Meyda.sampleRate = SR;
  Meyda.numberOfMFCCCoefficients = MFCC_COEFFICIENTS;
  Meyda.windowingFunction = 'hanning';

  for (const [name, frame] of FRAMES) {
    it(name, () => {
      const ours = frameFeatures(frame, SR);
      const theirs = Meyda.extract(['rms', 'spectralCentroid', 'mfcc'], frame);
      expect(ours.rms).toBeCloseTo(theirs?.rms ?? NaN, 6);
      expect(ours.centroidBins / (theirs?.spectralCentroid ?? NaN)).toBeCloseTo(1, 4);
      const mfcc = theirs?.mfcc ?? [];
      expect(ours.mfcc).toHaveLength(MFCC_COEFFICIENTS);
      ours.mfcc.forEach((value, i) => expect(value, `mfcc ${i}`).toBeCloseTo(mfcc[i] ?? NaN, 2));
    });
  }
});

describe('extractFrames', () => {
  it('steps through the buffer by the hop size', () => {
    const samples = tone(FEATURE_BUFFER_SIZE + 512 * 10, [[440, 0.5]]);
    const frames = extractFrames(samples, SR);
    expect(frames.rms).toHaveLength(11);
    expect(frames.centroidHz[0]).toBeCloseTo(440, -1);
  });

  it('reports a silent frame as zero', () => {
    const frames = extractFrames(new Float32Array(FEATURE_BUFFER_SIZE), SR);
    expect(frames.rms[0]).toBe(0);
    expect(frames.centroidHz[0]).toBe(0);
    expect(frames.mfcc[0]?.every((c) => c === 0)).toBe(true);
  });
});

describe('scaleToRms', () => {
  it('matches the overall level and leaves silence alone', () => {
    const loud = tone(4096, [[300, 0.9]]);
    expect(rmsOf(scaleToRms(loud, 0.1))).toBeCloseTo(0.1, 6);
    expect(rmsOf(scaleToRms(new Float32Array(100), 0.1))).toBe(0);
  });
});
