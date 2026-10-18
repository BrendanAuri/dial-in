/**
 * Mapping between a continuous parameter's value and a normalised 0–1
 * position (for knobs, sliders and random generation).
 */
import type { ContinuousParamDef } from './params';

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Clamp a value into the parameter's range, snapped to its step if it has one. Non-finite values become the default. */
export function clampToRange(def: ContinuousParamDef, value: number): number {
  if (!Number.isFinite(value)) return def.default;
  const snapped = def.step === undefined ? value : Math.round(value / def.step) * def.step;
  return Math.min(def.max, Math.max(def.min, snapped));
}

/** Value → 0–1 position. Log parameters are evenly spaced in octaves. */
export function toNormalised(def: ContinuousParamDef, value: number): number {
  const v = clampToRange(def, value);
  if (def.scale === 'log') {
    return clamp01(Math.log(v / def.min) / Math.log(def.max / def.min));
  }
  return clamp01((v - def.min) / (def.max - def.min));
}

/** 0–1 position → value. Inverse of toNormalised. */
export function fromNormalised(def: ContinuousParamDef, n: number): number {
  const t = clamp01(Number.isFinite(n) ? n : 0);
  if (def.scale === 'log') {
    return clampToRange(def, def.min * (def.max / def.min) ** t);
  }
  return clampToRange(def, def.min + t * (def.max - def.min));
}
