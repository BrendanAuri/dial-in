import { useId } from 'react';
import type { DiscreteOption } from '../../engine/params';

interface SelectorProps<V extends string | number> {
  readonly label: string;
  readonly options: readonly DiscreteOption<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
  /** Keep the label for screen readers but don't show it. */
  readonly hideLabel?: boolean;
}

/** Segmented control for a choice between a few options. */
export function Selector<V extends string | number>({ label, options, value, onChange, hideLabel }: SelectorProps<V>) {
  const labelId = useId();
  return (
    <div className={hideLabel ? 'selector compact' : 'selector'}>
      <div className={hideLabel ? 'visually-hidden' : 'selector-label'} id={labelId}>
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
