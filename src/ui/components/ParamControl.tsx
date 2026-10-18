import { PARAMS, isParamInUse, type ParamId, type Patch } from '../../engine/params';
import { Knob } from './Knob';
import { Selector } from './Selector';

interface ParamControlProps {
  readonly id: ParamId;
  readonly patch: Readonly<Patch>;
  readonly onChange: (id: ParamId, value: unknown) => void;
  readonly disabled?: boolean;
}

/** Why a control isn't in use, for the ones that depend on a mode. */
const UNUSED_REASONS: Partial<Record<ParamId, string>> = {
  'lfo.rate': 'Not used while Sync is on',
  'lfo.tempo': 'Only used when Sync is on',
};

/** The right control for a parameter: a knob for continuous ones, a selector for discrete ones. */
export function ParamControl({ id, patch, onChange, disabled }: ParamControlProps) {
  const def = PARAMS[id];
  if (def.kind === 'continuous') {
    const unused = isParamInUse(id, patch) ? undefined : UNUSED_REASONS[id];
    return (
      <Knob def={def} value={patch[def.id]} disabled={disabled} unused={unused} onChange={(value) => onChange(def.id, value)} />
    );
  }
  return (
    <Selector
      label={def.label}
      options={def.options}
      value={patch[def.id]}
      disabled={disabled}
      onChange={(value) => onChange(def.id, value)}
    />
  );
}
