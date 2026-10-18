/**
 * Per-frame audio features (loudness, brightness, timbre) from a rendered
 * buffer. Follows Meyda's definitions (Hann window, RMS of the windowed
 * frame, spectral centroid, MFCCs from a 26-band mel bank with log(1 + x)
 * and a ×2 DCT-II), but with a typed-array FFT and precomputed tables:
 * Meyda's per-frame overhead made a round's scoring take over a second.
 * The tests check these numbers against Meyda itself.
 */
import {
  FEATURE_BUFFER_SIZE,
  FEATURE_HOP_SIZE,
  LOW_END_BAND_EDGES_HZ,
  LOW_END_FFT_SIZE,
  LOW_END_FLOOR_DB,
  MFCC_COEFFICIENTS,
} from '../engine/constants';

/** Mel bands feeding the MFCCs (Meyda's default). */
const MEL_BANDS = 26;

export interface FeatureFrames {
  /** RMS of each windowed frame. */
  readonly rms: readonly number[];
  /** Spectral centroid of each frame in Hz (0 for a silent frame). */
  readonly centroidHz: readonly number[];
  readonly mfcc: readonly (readonly number[])[];
}

/** One frame's features, as produced for each step of extractFrames. */
export interface FrameFeatures {
  readonly rms: number;
  /** In FFT bins, like Meyda's spectralCentroid; NaN for silence. */
  readonly centroidBins: number;
  readonly mfcc: number[];
}

export function rmsOf(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return samples.length === 0 ? 0 : Math.sqrt(sum / samples.length);
}

/** A copy of `samples` scaled to an overall RMS of `level` (silence stays silent). */
export function scaleToRms(samples: Float32Array, level: number): Float32Array {
  const rms = rmsOf(samples);
  const scaled = new Float32Array(samples.length);
  if (rms === 0) return scaled;
  const gain = level / rms;
  for (let i = 0; i < samples.length; i++) scaled[i] = (samples[i] ?? 0) * gain;
  return scaled;
}

// ── Tables, built once per frame size and sample rate ────────────────────

interface MelFilter {
  readonly firstBin: number;
  readonly weights: Float64Array;
}

interface Tables {
  readonly size: number;
  readonly sampleRate: number;
  readonly window: Float32Array;
  readonly bitReverse: Uint32Array;
  readonly cos: Float64Array;
  readonly sin: Float64Array;
  readonly mel: readonly MelFilter[];
  readonly dct: Float64Array;
}

let tables: Tables | null = null;

const freqToMel = (hz: number): number => 1125 * Math.log(1 + hz / 700);
const melToFreq = (mel: number): number => 700 * (Math.exp(mel / 1125) - 1);

/** Triangular mel filters, built exactly as Meyda builds them (including its Float32 rounding). */
function melFilters(bands: number, sampleRate: number, size: number): MelFilter[] {
  const step = (freqToMel(sampleRate / 2) - freqToMel(0)) / (bands + 1);
  const bins = Array.from({ length: bands + 2 }, (_, i) => {
    const hz = Math.fround(melToFreq(Math.fround(i * step)));
    return Math.floor(((size + 1) * hz) / sampleRate);
  });
  const filters: MelFilter[] = [];
  for (let j = 0; j < bands; j++) {
    const low = bins[j] ?? 0;
    const mid = bins[j + 1] ?? 0;
    const high = bins[j + 2] ?? 0;
    const weights = new Float64Array(Math.max(0, high - low));
    for (let i = low; i < mid; i++) weights[i - low] = (i - low) / (mid - low);
    for (let i = mid; i < high; i++) weights[i - low] = (high - i) / (high - mid);
    filters.push({ firstBin: low, weights });
  }
  return filters;
}

function getTables(size: number, sampleRate: number): Tables {
  if (tables && tables.size === size && tables.sampleRate === sampleRate) return tables;
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  const bits = Math.log2(size);
  const bitReverse = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let reversed = 0;
    for (let b = 0; b < bits; b++) reversed |= ((i >> b) & 1) << (bits - 1 - b);
    bitReverse[i] = reversed;
  }
  const cos = new Float64Array(size / 2);
  const sin = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / size);
    sin[i] = -Math.sin((2 * Math.PI * i) / size);
  }
  const dct = new Float64Array(MEL_BANDS * MEL_BANDS);
  for (let k = 0; k < MEL_BANDS; k++) {
    for (let n = 0; n < MEL_BANDS; n++) dct[n + k * MEL_BANDS] = Math.cos((Math.PI / MEL_BANDS) * (n + 0.5) * k);
  }
  tables = { size, sampleRate, window, bitReverse, cos, sin, mel: melFilters(MEL_BANDS, sampleRate, size), dct };
  return tables;
}

// ── Per frame ────────────────────────────────────────────────────────────

/** In-place iterative radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array, t: Tables): void {
  const n = t.size;
  for (let i = 0; i < n; i++) {
    const j = t.bitReverse[i] ?? 0;
    if (j > i) {
      const r = re[i] ?? 0;
      re[i] = re[j] ?? 0;
      re[j] = r;
      const m = im[i] ?? 0;
      im[i] = im[j] ?? 0;
      im[j] = m;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const stride = n / len;
    for (let start = 0; start < n; start += len) {
      for (let k = 0; k < half; k++) {
        const wr = t.cos[k * stride] ?? 0;
        const wi = t.sin[k * stride] ?? 0;
        const a = start + k;
        const b = a + half;
        const br = re[b] ?? 0;
        const bi = im[b] ?? 0;
        const tr = br * wr - bi * wi;
        const ti = br * wi + bi * wr;
        re[b] = (re[a] ?? 0) - tr;
        im[b] = (im[a] ?? 0) - ti;
        re[a] = (re[a] ?? 0) + tr;
        im[a] = (im[a] ?? 0) + ti;
      }
    }
  }
}

/** Features of one frame of exactly the table size, using scratch arrays `re` and `im`. */
function analyseFrame(frame: Float32Array, t: Tables, re: Float64Array, im: Float64Array): FrameFeatures {
  let energy = 0;
  for (let i = 0; i < t.size; i++) {
    const windowed = Math.fround((frame[i] ?? 0) * (t.window[i] ?? 0));
    re[i] = windowed;
    im[i] = 0;
    energy += windowed * windowed;
  }
  fft(re, im, t);

  const bins = t.size / 2;
  let weightedSum = 0;
  let ampSum = 0;
  for (let k = 0; k < bins; k++) {
    const amp = Math.sqrt((re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2);
    re[k] = amp; // Reuse re as the amplitude spectrum.
    weightedSum += k * amp;
    ampSum += amp;
  }

  const logMel = new Float64Array(MEL_BANDS);
  t.mel.forEach((filter, band) => {
    let sum = 0;
    const end = Math.min(filter.weights.length, bins - filter.firstBin);
    for (let i = 0; i < end; i++) sum += (filter.weights[i] ?? 0) * (re[filter.firstBin + i] ?? 0) ** 2;
    logMel[band] = Math.log(sum + 1);
  });
  const mfcc: number[] = [];
  for (let k = 0; k < MFCC_COEFFICIENTS; k++) {
    let sum = 0;
    for (let n = 0; n < MEL_BANDS; n++) sum += (logMel[n] ?? 0) * (t.dct[n + k * MEL_BANDS] ?? 0);
    mfcc.push(2 * sum);
  }

  return { rms: Math.sqrt(energy / t.size), centroidBins: weightedSum / ampSum, mfcc };
}

/**
 * Mean power of each FFT bin (0 … size / 2 − 1) across every frame. By
 * default it uses the same window and hop as the features, as the result
 * overlay's spectrum does.
 */
export function averagePowerSpectrum(
  samples: Float32Array,
  sampleRate: number,
  size: number = FEATURE_BUFFER_SIZE,
  hop: number = FEATURE_HOP_SIZE,
): Float64Array {
  const t = getTables(size, sampleRate);
  const re = new Float64Array(t.size);
  const im = new Float64Array(t.size);
  const bins = t.size / 2;
  const sum = new Float64Array(bins);
  let frames = 0;
  for (let start = 0; start + t.size <= samples.length; start += hop) {
    for (let i = 0; i < t.size; i++) {
      re[i] = (samples[start + i] ?? 0) * (t.window[i] ?? 0);
      im[i] = 0;
    }
    fft(re, im, t);
    for (let k = 0; k < bins; k++) sum[k] = (sum[k] ?? 0) + (re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2;
    frames++;
  }
  if (frames > 0) for (let k = 0; k < bins; k++) sum[k] = (sum[k] ?? 0) / frames;
  return sum;
}

/**
 * How much of the sound's energy sits in each low octave band
 * (LOW_END_BAND_EDGES_HZ), in dB of the total, floored at LOW_END_FLOOR_DB.
 * Every band is at the floor for silence.
 */
export function lowEndLevels(samples: Float32Array, sampleRate: number): number[] {
  const power = averagePowerSpectrum(samples, sampleRate, LOW_END_FFT_SIZE, LOW_END_FFT_SIZE / 2);
  const hzPerBin = sampleRate / LOW_END_FFT_SIZE;
  const total = power.reduce((sum, p) => sum + p, 0);
  const levels: number[] = [];
  for (let band = 0; band + 1 < LOW_END_BAND_EDGES_HZ.length; band++) {
    const low = LOW_END_BAND_EDGES_HZ[band] ?? 0;
    const high = LOW_END_BAND_EDGES_HZ[band + 1] ?? 0;
    let sum = 0;
    for (let k = Math.ceil(low / hzPerBin); k * hzPerBin < high && k < power.length; k++) sum += power[k] ?? 0;
    const db = total > 0 && sum > 0 ? 10 * Math.log10(sum / total) : LOW_END_FLOOR_DB;
    levels.push(Math.max(LOW_END_FLOOR_DB, db));
  }
  return levels;
}

/** Features of a single FEATURE_BUFFER_SIZE frame (exposed for tests). */
export function frameFeatures(frame: Float32Array, sampleRate: number): FrameFeatures {
  const t = getTables(FEATURE_BUFFER_SIZE, sampleRate);
  return analyseFrame(frame, t, new Float64Array(t.size), new Float64Array(t.size));
}

/** Features for each FEATURE_BUFFER_SIZE frame, stepping by FEATURE_HOP_SIZE. */
export function extractFrames(samples: Float32Array, sampleRate: number): FeatureFrames {
  const t = getTables(FEATURE_BUFFER_SIZE, sampleRate);
  const re = new Float64Array(t.size);
  const im = new Float64Array(t.size);
  const hzPerBin = sampleRate / FEATURE_BUFFER_SIZE;
  const rms: number[] = [];
  const centroidHz: number[] = [];
  const mfcc: number[][] = [];
  for (let start = 0; start + FEATURE_BUFFER_SIZE <= samples.length; start += FEATURE_HOP_SIZE) {
    const features = analyseFrame(samples.subarray(start, start + FEATURE_BUFFER_SIZE), t, re, im);
    rms.push(features.rms);
    centroidHz.push(Number.isFinite(features.centroidBins) ? features.centroidBins * hzPerBin : 0);
    mfcc.push(features.mfcc);
  }
  return { rms, centroidHz, mfcc };
}
