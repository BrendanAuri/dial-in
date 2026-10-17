/**
 * Long-term spectra for the result overlay: a render's average power in
 * log-spaced bands, plus its spectral centre (a "brightness" figure).
 */
import {
  FEATURE_BUFFER_SIZE,
  OVERLAY_BANDS,
  RMS_MATCH_LEVEL,
  SPECTRUM_MAX_HZ,
  SPECTRUM_MIN_HZ,
} from '../engine/constants';
import { averagePowerSpectrum, scaleToRms } from './audioFeatures';

/** Power below this counts as silence, so the dB maths stays finite. */
const POWER_FLOOR = 1e-12;

export interface BandSpectrum {
  /** Centre frequency of each band (geometric mean of its edges), in Hz. */
  readonly hz: readonly number[];
  /** Mean power in each band, in dB. */
  readonly db: readonly number[];
  /** Amplitude-weighted mean frequency, in Hz (0 for silence). */
  readonly centreHz: number;
}

/** `count + 1` edges spaced evenly on a log scale from `minHz` to `maxHz`. */
export function bandEdges(minHz: number, maxHz: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, i) => minHz * (maxHz / minHz) ** (i / count));
}

/**
 * Power at a frequency between bins, interpolated in log power (so in dB),
 * which draws as a smooth curve rather than plateaus and jumps.
 */
function powerAt(power: Float64Array, bin: number): number {
  const below = Math.max(0, Math.min(power.length - 1, Math.floor(bin)));
  const above = Math.min(power.length - 1, below + 1);
  const t = Math.min(1, Math.max(0, bin - below));
  const low = Math.log(Math.max(POWER_FLOOR, power[below] ?? 0));
  const high = Math.log(Math.max(POWER_FLOOR, power[above] ?? 0));
  return Math.exp(low * (1 - t) + high * t);
}

/**
 * Average a power spectrum into bands. Bands narrower than one FFT bin
 * (at the low end) interpolate between the bins either side of their centre.
 */
export function toBands(power: Float64Array, sampleRate: number, fftSize: number, edges: readonly number[]): Omit<BandSpectrum, 'centreHz'> {
  const hzPerBin = sampleRate / fftSize;
  const hz: number[] = [];
  const db: number[] = [];
  for (let b = 0; b + 1 < edges.length; b++) {
    const low = edges[b] ?? 0;
    const high = edges[b + 1] ?? 0;
    const centre = Math.sqrt(low * high);
    const first = Math.ceil(low / hzPerBin);
    const last = Math.min(power.length - 1, Math.floor(high / hzPerBin));
    let sum = 0;
    let count = 0;
    for (let k = first; k <= last; k++) {
      sum += power[k] ?? 0;
      count++;
    }
    const mean = count > 0 ? sum / count : powerAt(power, centre / hzPerBin);
    hz.push(centre);
    db.push(10 * Math.log10(Math.max(POWER_FLOOR, mean)));
  }
  return { hz, db };
}

/** Amplitude-weighted mean frequency of a power spectrum, like a spectral centroid. */
export function spectralCentreHz(power: Float64Array, sampleRate: number, fftSize: number): number {
  const hzPerBin = sampleRate / fftSize;
  let weighted = 0;
  let total = 0;
  power.forEach((p, k) => {
    const amplitude = Math.sqrt(p);
    weighted += k * hzPerBin * amplitude;
    total += amplitude;
  });
  return total > 0 ? weighted / total : 0;
}

const EDGES = bandEdges(SPECTRUM_MIN_HZ, SPECTRUM_MAX_HZ, OVERLAY_BANDS);

/** The overlay spectrum of a render, after matching its overall level like the audio score does. */
export function bandSpectrum(samples: Float32Array, sampleRate: number): BandSpectrum {
  const power = averagePowerSpectrum(scaleToRms(samples, RMS_MATCH_LEVEL), sampleRate);
  return { ...toBands(power, sampleRate, FEATURE_BUFFER_SIZE, EDGES), centreHz: spectralCentreHz(power, sampleRate, FEATURE_BUFFER_SIZE) };
}
