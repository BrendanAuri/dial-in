/** Mapping between frequencies, dB and pixels for the spectrum views (log frequency axis). */

export interface FrequencyAxis {
  readonly minHz: number;
  readonly maxHz: number;
}

/** 0–1 position of `hz` along a log axis (clamped). */
export function axisPosition(hz: number, axis: FrequencyAxis): number {
  const t = Math.log(hz / axis.minHz) / Math.log(axis.maxHz / axis.minHz);
  return Math.min(1, Math.max(0, t));
}

/** 0–1 position of `db` between `bottomDb` (0) and `topDb` (1), clamped. */
export function levelPosition(db: number, bottomDb: number, topDb: number): number {
  return Math.min(1, Math.max(0, (db - bottomDb) / (topDb - bottomDb)));
}

/**
 * For each of `columns` pixel columns, the analyser bins [start, end) it
 * covers. Low columns span less than a bin and get the one bin underneath.
 */
export function columnBins(columns: number, sampleRate: number, fftSize: number, axis: FrequencyAxis): [number, number][] {
  const hzPerBin = sampleRate / fftSize;
  const lastBin = fftSize / 2 - 1;
  return Array.from({ length: columns }, (_, x) => {
    const low = axis.minHz * (axis.maxHz / axis.minHz) ** (x / columns);
    const high = axis.minHz * (axis.maxHz / axis.minHz) ** ((x + 1) / columns);
    const start = Math.min(lastBin, Math.floor(low / hzPerBin));
    const end = Math.min(lastBin + 1, Math.max(start + 1, Math.ceil(high / hzPerBin)));
    return [start, end];
  });
}

/** Grid lines worth labelling within the axis. */
export const GRID_HZ: readonly number[] = [100, 1000, 10000];

export function formatGridHz(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
}
