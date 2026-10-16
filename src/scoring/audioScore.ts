/**
 * The audio score: a safety net that compares how two renders actually
 * sound, so different settings that sound alike aren't marked down.
 * Compares loudness over time, brightness and timbre, after matching
 * overall volume.
 */
import {
  AUDIO_CALIBRATION,
  LOUDNESS_FLOOR_DB,
  MIN_CENTROID_HZ,
  RMS_MATCH_LEVEL,
  SPECTRUM_GATE_DB,
} from '../engine/constants';
import { extractFrames, scaleToRms, type FeatureFrames } from './audioFeatures';

export interface AudioDistances {
  /** Mean absolute difference in frame loudness, in dB. */
  readonly loudnessDb: number;
  /** Mean absolute difference in spectral centroid, in octaves. */
  readonly brightnessOctaves: number;
  /** Mean Euclidean distance between frame MFCCs. */
  readonly timbre: number;
}

export interface AudioScore {
  /** 0–100: the mean of the three parts. */
  readonly score: number;
  readonly parts: { readonly loudness: number; readonly brightness: number; readonly timbre: number };
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
export function compareFrames(a: FeatureFrames, b: FeatureFrames): AudioDistances {
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
  };
  return { score: (parts.loudness + parts.brightness + parts.timbre) / 3, parts, distances };
}

/** Compare two renders of the same length and sample rate. */
export function audioScore(a: Float32Array, b: Float32Array, sampleRate: number): AudioScore {
  const framesA = extractFrames(scaleToRms(a, RMS_MATCH_LEVEL), sampleRate);
  const framesB = extractFrames(scaleToRms(b, RMS_MATCH_LEVEL), sampleRate);
  return audioScoreFromDistances(compareFrames(framesA, framesB));
}
