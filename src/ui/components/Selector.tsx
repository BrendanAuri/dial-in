import { useId } from 'react';
import type { DiscreteOption, DiscreteValue } from '../../engine/params';

interface SelectorProps<V extends DiscreteValue> {
  readonly label: string;
  readonly options: readonly DiscreteOption<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
}

/** Segmented control for a discrete parameter. */
export function Selector<V extends DiscreteValue>({ label, options, value, onChange }: SelectorProps<V>) {
  const labelId = useId();
  return (
    <div className="selector">
      <div className="selector-label" id={labelId}>
        {label}
      </div>
      <div className="selector-options" role="radiogroup" aria-labelledby={labelId}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className={option.value === value ? 'selector-option selected' : 'selector-option'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
