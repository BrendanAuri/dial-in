/**
 * The audio score: a safety net that compares how two renders actually
 * sound, so different settings that sound alike aren't marked down.
 * Compares loudness over time, brightness, timbre and the low end, after
 * matching overall volume.
 */
import {
  AUDIO_CALIBRATION,
  LOUDNESS_FLOOR_DB,
  LOW_END_FLOOR_DB,
  MIN_CENTROID_HZ,
  RMS_MATCH_LEVEL,
  SPECTRUM_GATE_DB,
} from '../engine/constants';
import { extractFrames, lowEndLevels, scaleToRms, type FeatureFrames } from './audioFeatures';

/** The parts compared frame by frame. */
export interface FrameDistances {
  /** Mean absolute difference in frame loudness, in dB. */
  readonly loudnessDb: number;
  /** Mean absolute difference in spectral centroid, in octaves. */
  readonly brightnessOctaves: number;
  /** Mean Euclidean distance between frame MFCCs. */
  readonly timbre: number;
}

export interface AudioDistances extends FrameDistances {
  /**
   * Mean absolute difference in the low octave bands' share of the energy,
   * in dB. Null when neither sound has any to speak of there, so the part
   * is left out.
   */
  readonly lowEndDb: number | null;
}

export interface AudioScore {
  /** 0–100: the mean of the three main parts, pulled down by the low end where it disagrees. */
  readonly score: number;
  readonly parts: {
    readonly loudness: number;
    readonly brightness: number;
    readonly timbre: number;
    /** Null when neither sound has a low end. */
    readonly lowEnd: number | null;
  };
  readonly distances: AudioDistances;
}

export interface Calibration {
  /** Distances up to this score 100. */
  readonly perfect: number;
  /** Distances from this score 0. */
  readonly zero: number;
}

function toDb(rms: number): number {
  return Math.max(LOUDNESS_FLOOR_DB, rms > 0 ? 20 * Math.log10(rms) : LOUDNESS_FLOOR_DB);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function euclidean(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) sum += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
  return Math.sqrt(sum);
}

/**
 * Loudness is compared over frames where either side makes sound. Timbre
 * too, so sound against silence counts as very different. Brightness only
 * means something where both sides make sound; if they never overlap but
 * one is audible, brightness counts as completely different.
 */
export function compareFrames(a: FeatureFrames, b: FeatureFrames): FrameDistances {
  const loudness: number[] = [];
  const brightness: number[] = [];
  const timbre: number[] = [];
  const frames = Math.min(a.rms.length, b.rms.length);
  for (let i = 0; i < frames; i++) {
    const dbA = toDb(a.rms[i] ?? 0);
    const dbB = toDb(b.rms[i] ?? 0);
    if (dbA <= LOUDNESS_FLOOR_DB && dbB <= LOUDNESS_FLOOR_DB) continue;
    loudness.push(Math.abs(dbA - dbB));
    const audibleA = dbA > SPECTRUM_GATE_DB;
    const audibleB = dbB > SPECTRUM_GATE_DB;
    if (audibleA || audibleB) timbre.push(euclidean(a.mfcc[i] ?? [], b.mfcc[i] ?? []));
    if (audibleA && audibleB) {
      const centroidA = Math.max(MIN_CENTROID_HZ, a.centroidHz[i] ?? 0);
      const centroidB = Math.max(MIN_CENTROID_HZ, b.centroidHz[i] ?? 0);
      brightness.push(Math.abs(Math.log2(centroidA / centroidB)));
    }
  }
  return {
    loudnessDb: mean(loudness),
    brightnessOctaves: brightness.length === 0 && timbre.length > 0 ? AUDIO_CALIBRATION.brightnessOctaves.zero : mean(brightness),
    timbre: mean(timbre),
  };
}

/** Compare low-end band levels, skipping bands where both are at the floor. Null if every band is. */
export function compareLowEnd(a: readonly number[], b: readonly number[]): number | null {
  const differences: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const levelA = a[i] ?? LOW_END_FLOOR_DB;
    const levelB = b[i] ?? LOW_END_FLOOR_DB;
    if (levelA <= LOW_END_FLOOR_DB && levelB <= LOW_END_FLOOR_DB) continue;
    differences.push(Math.abs(levelA - levelB));
  }
  return differences.length === 0 ? null : mean(differences);
}

/** Map a raw distance to 0–100. */
export function partScore(distance: number, calibration: Calibration): number {
  const t = (distance - calibration.perfect) / (calibration.zero - calibration.perfect);
  return 100 * Math.min(1, Math.max(0, 1 - t));
}

export function audioScoreFromDistances(distances: AudioDistances): AudioScore {
  const parts = {
    loudness: partScore(distances.loudnessDb, AUDIO_CALIBRATION.loudnessDb),
    brightness: partScore(distances.brightnessOctaves, AUDIO_CALIBRATION.brightnessOctaves),
    timbre: partScore(distances.timbre, AUDIO_CALIBRATION.timbre),
    lowEnd: distances.lowEndDb === null ? null : partScore(distances.lowEndDb, AUDIO_CALIBRATION.lowEndDb),
  };
  const main = mean([parts.loudness, parts.brightness, parts.timbre]);
  // The low end can only lower the score: it catches what the other parts
  // miss (a sub), and mustn't soften differences they did hear.
  const score = parts.lowEnd === null ? main : Math.min(main, mean([parts.loudness, parts.brightness, parts.timbre, parts.lowEnd]));
  return { score, parts, distances };
}

/** Compare two renders of the same length and sample rate. */
export function audioScore(a: Float32Array, b: Float32Array, sampleRate: number): AudioScore {
  const framesA = extractFrames(scaleToRms(a, RMS_MATCH_LEVEL), sampleRate);
  const framesB = extractFrames(scaleToRms(b, RMS_MATCH_LEVEL), sampleRate);
  const lowEndDb = compareLowEnd(lowEndLevels(a, sampleRate), lowEndLevels(b, sampleRate));
  return audioScoreFromDistances({ ...compareFrames(framesA, framesB), lowEndDb });
}
