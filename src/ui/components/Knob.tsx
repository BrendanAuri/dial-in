import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import {
  DOUBLE_TAP_MS,
  KNOB_DRAG_PIXELS,
  KNOB_FINE_FACTOR,
  KNOB_KEY_STEP,
  KNOB_PAGE_STEP,
  KNOB_SWEEP_DEGREES,
} from '../../engine/constants';
import type { ContinuousParamDef } from '../../engine/params';
import { clamp01, fromNormalised, toNormalised } from '../../engine/scale';
import { formatValue } from '../format';

// SVG geometry, in viewBox units.
const VIEWBOX = 100;
const CENTRE = VIEWBOX / 2;
const RADIUS = 38;
const POINTER_INNER = 18;

interface KnobProps {
  readonly def: ContinuousParamDef;
  readonly value: number;
  readonly onChange: (value: number) => void;
  /** Locked: shown greyed out and can't be changed. */
  readonly disabled?: boolean;
  /** Why the knob does nothing in the current patch, if it doesn't. It's dimmed but still works. */
  readonly unused?: string;
}

/** Point on the knob circle; 0° is straight up, positive is clockwise. */
function polar(radius: number, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return { x: CENTRE + radius * Math.sin(radians), y: CENTRE - radius * Math.cos(radians) };
}

function arcPath(fromDegrees: number, toDegrees: number): string {
  const start = polar(RADIUS, fromDegrees);
  const end = polar(RADIUS, toDegrees);
  const largeArc = toDegrees - fromDegrees > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/**
 * Rotary control. Drag vertically (Shift for fine), double-tap to reset,
 * arrow keys / Page Up / Page Down / Home / End when focused.
 */
export function Knob({ def, value, onChange, disabled = false, unused }: KnobProps) {
  const position = toNormalised(def, value);
  const drag = useRef<{ lastY: number; position: number } | null>(null);
  const lastTap = useRef(-Infinity);

  const setPosition = (next: number): void => onChange(fromNormalised(def, clamp01(next)));

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    if (event.timeStamp - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = -Infinity;
      drag.current = null;
      onChange(def.default);
      return;
    }
    lastTap.current = event.timeStamp;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { lastY: event.clientY, position };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    const state = drag.current;
    if (!state) return;
    const factor = event.shiftKey ? KNOB_FINE_FACTOR : 1;
    state.position = clamp01(state.position + ((state.lastY - event.clientY) / KNOB_DRAG_PIXELS) * factor);
    state.lastY = event.clientY;
    setPosition(state.position);
  }

  function endDrag(): void {
    drag.current = null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const step = KNOB_KEY_STEP * (event.shiftKey ? KNOB_FINE_FACTOR : 1);
    const next: Partial<Record<string, number>> = {
      ArrowUp: position + step,
      ArrowRight: position + step,
      ArrowDown: position - step,
      ArrowLeft: position - step,
      PageUp: position + KNOB_PAGE_STEP,
      PageDown: position - KNOB_PAGE_STEP,
      Home: 0,
      End: 1,
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setPosition(target);
  }

  const start = -KNOB_SWEEP_DEGREES / 2;
  const angle = start + position * KNOB_SWEEP_DEGREES;
  const tip = polar(RADIUS, angle);
  const inner = polar(POINTER_INNER, angle);
  const text = formatValue(def, value);

  const handlers = disabled
    ? {}
    : { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown };

  return (
    <div className={['knob', disabled ? 'disabled' : null, unused ? 'unused' : null].filter(Boolean).join(' ')} title={unused}>
      <div
        className="knob-dial"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={def.label}
        aria-disabled={disabled || undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position * 100)}
        aria-valuetext={unused ? `${text}, ${unused.toLowerCase()}` : text}
        {...handlers}
      >
        <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} aria-hidden="true">
          <path className="knob-track" d={arcPath(start, -start)} />
          {position > 0 && <path className="knob-value" d={arcPath(start, angle)} />}
          <line className="knob-pointer" x1={inner.x} y1={inner.y} x2={tip.x} y2={tip.y} />
        </svg>
      </div>
      <div className="knob-label">{def.label}</div>
      <div className="knob-readout">{text}</div>
    </div>
  );
}
