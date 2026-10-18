/** Display formatting for parameter values. */
import { PARAMS, type ContinuousParamDef, type ParamId, type Patch } from '../engine/params';

const HZ_PER_KHZ = 1000;
const MS_PER_SECOND = 1000;
const PERCENT = 100;

/** Fewer decimals as numbers get bigger: 1.23, 12.3, 123. */
function compact(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/** "440 Hz", "1.25 kHz". */
export function formatHz(hz: number): string {
  return hz >= HZ_PER_KHZ ? `${compact(hz / HZ_PER_KHZ)} kHz` : `${compact(hz)} Hz`;
}

export function formatValue(def: ContinuousParamDef, value: number): string {
  switch (def.unit) {
    case 'Hz':
      return formatHz(value);
    case 's':
      return value >= 1 ? `${value.toFixed(2)} s` : `${compact(value * MS_PER_SECOND)} ms`;
    case '%':
      return `${Math.round(value * PERCENT)} %`;
    case 'cents':
      return `${value.toFixed(1)} cents`;
    case 'oct':
      return `${value.toFixed(2)} oct`;
    case 'BPM':
      return `${Math.round(value)} BPM`;
  }
}

/** Any parameter's value as shown to the player: units for numbers, labels for choices. */
export function formatParam(id: ParamId, patch: Readonly<Patch>): string {
  const def = PARAMS[id];
  if (def.kind === 'continuous') return formatValue(def, patch[def.id]);
  const value: unknown = patch[def.id];
  return def.options.find((option) => option.value === value)?.label ?? String(value);
}
