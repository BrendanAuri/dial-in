import { describe, expect, it } from 'vitest';
import { FEATURE_BUFFER_SIZE, OVERLAY_BANDS, RENDER_SAMPLE_RATE } from '../engine/constants';
import { averagePowerSpectrum } from './audioFeatures';
import { bandEdges, bandSpectrum, spectralCentreHz, toBands } from './spectrum';

const SR = RENDER_SAMPLE_RATE;
const HZ_PER_BIN = SR / FEATURE_BUFFER_SIZE;

function sine(hz: number, amplitude = 0.5, seconds = 0.5): Float32Array {
  return Float32Array.from({ length: SR * seconds }, (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / SR));
}

describe('bandEdges', () => {
  it('spaces edges evenly in octaves', () => {
    const edges = bandEdges(100, 1600, 4);
    expect(edges).toHaveLength(5);
    edges.forEach((edge, i) => expect(edge).toBeCloseTo(100 * 2 ** i));
  });
});

describe('toBands', () => {
  it('puts a single-bin peak in the band containing it', () => {
    const power = new Float64Array(FEATURE_BUFFER_SIZE / 2);
    const bin = Math.round(1000 / HZ_PER_BIN);
    power[bin] = 1;
    const edges = bandEdges(30, 16000, 48);
    const { hz, db } = toBands(power, SR, FEATURE_BUFFER_SIZE, edges);
    const loudest = db.indexOf(Math.max(...db));
    expect(edges[loudest]).toBeLessThanOrEqual(bin * HZ_PER_BIN);
    expect(edges[loudest + 1]).toBeGreaterThanOrEqual(bin * HZ_PER_BIN);
    expect(hz[loudest]).toBeGreaterThan(700);
    expect(hz[loudest]).toBeLessThan(1400);
  });

  it('fills bands narrower than a bin from the bin under them', () => {
    const power = new Float64Array(FEATURE_BUFFER_SIZE / 2).fill(1);
    const { db } = toBands(power, SR, FEATURE_BUFFER_SIZE, bandEdges(30, 60, 8));
    expect(db.every((d) => Math.abs(d) < 1e-9)).toBe(true);
  });
});

describe('spectra of renders', () => {
  it('peaks at a sine’s frequency, with its spectral centre there too', () => {
    const power = averagePowerSpectrum(sine(1000), SR);
    expect(power.indexOf(Math.max(...power)) * HZ_PER_BIN).toBeCloseTo(1000, -2);
    expect(spectralCentreHz(power, SR, FEATURE_BUFFER_SIZE)).toBeGreaterThan(800);
    expect(spectralCentreHz(power, SR, FEATURE_BUFFER_SIZE)).toBeLessThan(1300);
  });

  it('gives OVERLAY_BANDS bands and ignores overall volume', () => {
    const loud = bandSpectrum(sine(440, 0.8), SR);
    const quiet = bandSpectrum(sine(440, 0.05), SR);
    expect(loud.db).toHaveLength(OVERLAY_BANDS);
    loud.db.forEach((d, i) => expect(d).toBeCloseTo(quiet.db[i] ?? NaN, 3));
  });

  it('reports a silent render as silent', () => {
    const silent = bandSpectrum(new Float32Array(SR / 4), SR);
    expect(silent.centreHz).toBe(0);
    expect(Math.max(...silent.db)).toBeLessThan(-100);
  });
});
