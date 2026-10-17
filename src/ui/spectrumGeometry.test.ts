import { describe, expect, it } from 'vitest';
import type { PairSpectra } from '../game/measureAudio';
import { brightnessCaption } from './components/SpectrumOverlay';
import { axisPosition, columnBins, formatGridHz, levelPosition } from './spectrumGeometry';

const AXIS = { minHz: 30, maxHz: 16000 };

describe('spectrum geometry', () => {
  it('places frequencies on a log axis', () => {
    expect(axisPosition(30, AXIS)).toBe(0);
    expect(axisPosition(16000, AXIS)).toBe(1);
    expect(axisPosition(Math.sqrt(30 * 16000), AXIS)).toBeCloseTo(0.5);
    expect(axisPosition(5, AXIS)).toBe(0);
    expect(axisPosition(40000, AXIS)).toBe(1);
  });

  it('places levels between a floor and a ceiling', () => {
    expect(levelPosition(-100, -100, -20)).toBe(0);
    expect(levelPosition(-60, -100, -20)).toBe(0.5);
    expect(levelPosition(-Infinity, -100, -20)).toBe(0);
    expect(levelPosition(0, -100, -20)).toBe(1);
  });

  it('gives every column a non-empty, increasing run of analyser bins', () => {
    const columns = columnBins(200, 48000, 4096, AXIS);
    expect(columns).toHaveLength(200);
    columns.forEach(([start, end], i) => {
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(2048);
      if (i > 0) expect(start).toBeGreaterThanOrEqual(columns[i - 1]?.[0] ?? 0);
    });
  });

  it('labels grid lines compactly', () => {
    expect([100, 1000, 10000].map(formatGridHz)).toEqual(['100', '1k', '10k']);
  });
});

describe('brightnessCaption', () => {
  const spectrum = (centreHz: number) => ({ hz: [], db: [], centreHz });
  const pair = (target: number, mine: number): PairSpectra => ({ target: spectrum(target), mine: spectrum(mine) });

  it('says which is brighter, or that they match', () => {
    expect(brightnessCaption(pair(1800, 900))).toBe('Spectral centre: target 1.80 kHz, yours 900 Hz, so yours is darker.');
    expect(brightnessCaption(pair(900, 1800))).toMatch(/yours is brighter/);
    expect(brightnessCaption(pair(1000, 1050))).toMatch(/about the same brightness/);
    expect(brightnessCaption(pair(0, 500))).toBe('Spectral centre: target 0.00 Hz, yours 500 Hz.');
  });
});
