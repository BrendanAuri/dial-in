import { PARAMS, type ParamId, type Patch } from '../../engine/params';
import { Knob } from './Knob';
import { Selector } from './Selector';

interface ParamControlProps {
  readonly id: ParamId;
  readonly patch: Readonly<Patch>;
  readonly onChange: (id: ParamId, value: unknown) => void;
  readonly disabled?: boolean;
}

/** The right control for a parameter: a knob for continuous ones, a selector for discrete ones. */
export function ParamControl({ id, patch, onChange, disabled }: ParamControlProps) {
  const def = PARAMS[id];
  if (def.kind === 'continuous') {
    return <Knob def={def} value={patch[def.id]} disabled={disabled} onChange={(value) => onChange(def.id, value)} />;
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
