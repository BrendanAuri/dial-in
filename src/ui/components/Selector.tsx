import { useId } from 'react';
import { SELECTOR_MAX_ONE_ROW, SELECTOR_ROW_OPTIONS } from '../../engine/constants';
import type { DiscreteOption } from '../../engine/params';

interface SelectorProps<V extends string | number> {
  readonly label: string;
  readonly options: readonly DiscreteOption<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
  /** Keep the label for screen readers but don't show it. */
  readonly hideLabel?: boolean;
  /** Locked: shown greyed out and can't be changed. */
  readonly disabled?: boolean;
}

/** Segmented control for a choice between a few options. */
export function Selector<V extends string | number>({
  label,
  options,
  value,
  onChange,
  hideLabel,
  disabled = false,
}: SelectorProps<V>) {
  const labelId = useId();
  const classes = ['selector', hideLabel ? 'compact' : null, disabled ? 'disabled' : null].filter(Boolean);
  return (
    <div className={classes.join(' ')}>
      <div className={hideLabel ? 'visually-hidden' : 'selector-label'} id={labelId}>
        {label}
      </div>
      <div
        className={options.length > SELECTOR_MAX_ONE_ROW ? 'selector-options wrap' : 'selector-options'}
        style={options.length > SELECTOR_MAX_ONE_ROW ? { gridTemplateColumns: `repeat(${SELECTOR_ROW_OPTIONS}, 1fr)` } : undefined}
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            disabled={disabled}
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
