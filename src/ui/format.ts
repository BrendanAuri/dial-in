/** Display formatting for parameter values. */
import { MODULES, PARAMS, PARAM_IDS, type ContinuousParamDef, type ParamId, type Patch } from '../engine/params';

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

/** Labels that need their module to make sense on their own: shared ones, plus a few generic words. */
const CONTEXT_LABELS = new Set([
  ...PARAM_IDS.map((id) => PARAMS[id].label).filter((label, i, all) => all.indexOf(label) !== i),
  'Amount',
  'Rate',
  'Depth',
  'Target',
]);

/** A control's name, with its module added where the label alone is unclear ("Amp envelope decay", "LFO rate"). */
export function controlName(id: ParamId): string {
  const def = PARAMS[id];
  if (!CONTEXT_LABELS.has(def.label)) return def.label;
  const module = MODULES.find((m) => m.id === def.module)?.label ?? def.module;
  return `${module} ${def.label.toLowerCase()}`;
}

/** Any parameter's value as shown to the player: units for numbers, labels for choices. */
export function formatParam(id: ParamId, patch: Readonly<Patch>): string {
  const def = PARAMS[id];
  if (def.kind === 'continuous') return formatValue(def, patch[def.id]);
  const value: unknown = patch[def.id];
  return def.options.find((option) => option.value === value)?.label ?? String(value);
}
