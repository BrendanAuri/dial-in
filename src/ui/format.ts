/** Display formatting for parameter values. */
import type { ContinuousParamDef } from '../engine/params';

const HZ_PER_KHZ = 1000;
const MS_PER_SECOND = 1000;
const PERCENT = 100;

/** Fewer decimals as numbers get bigger: 1.23, 12.3, 123. */
function compact(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function formatValue(def: ContinuousParamDef, value: number): string {
  switch (def.unit) {
    case 'Hz':
      return value >= HZ_PER_KHZ ? `${compact(value / HZ_PER_KHZ)} kHz` : `${compact(value)} Hz`;
    case 's':
      return value >= 1 ? `${value.toFixed(2)} s` : `${compact(value * MS_PER_SECOND)} ms`;
    case '%':
      return `${Math.round(value * PERCENT)} %`;
    case 'cents':
      return `${value.toFixed(1)} cents`;
    case 'oct':
      return `${value.toFixed(2)} oct`;
  }
}
