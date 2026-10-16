/**
 * Computer keyboard → notes, by physical key position (KeyboardEvent.code),
 * so it works the same on any layout. The A row plays white keys and the
 * row above plays black keys, like most DAWs.
 */
import { MIDI_C0, SEMITONES_PER_OCTAVE } from '../engine/constants';

/** Semitones above the keyboard's lowest C. */
export const NOTE_KEYS: Readonly<Record<string, number>> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
};

export const OCTAVE_DOWN_KEY = 'KeyZ';
export const OCTAVE_UP_KEY = 'KeyX';

/** MIDI note of the C that starts `octave` (C3 = 48). */
export function lowestNoteForOctave(octave: number): number {
  return MIDI_C0 + octave * SEMITONES_PER_OCTAVE;
}

export function noteForKey(code: string, octave: number): number | null {
  const offset = NOTE_KEYS[code];
  return offset === undefined ? null : lowestNoteForOctave(octave) + offset;
}

/** The letter that plays a given offset, e.g. 0 → 'A', 1 → 'W'. */
export function keyLabelForOffset(offset: number): string | null {
  const entry = Object.entries(NOTE_KEYS).find(([, value]) => value === offset);
  return entry ? entry[0].replace('Key', '') : null;
}
