/** Note names and pitch. C4 (middle C) is MIDI 60. */
import { A4_HZ, A4_MIDI, MIDI_C0, SEMITONES_PER_OCTAVE } from './constants';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const PITCH_CLASSES: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const NOTE_PATTERN = /^([A-Ga-g])([#b]?)(-?\d+)$/;

export function midiToHz(midi: number): number {
  return A4_HZ * 2 ** ((midi - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

/** 'C3' → 48, 'F#2' → 42, 'Bb4' → 70. Throws on anything else. */
export function noteNameToMidi(name: string): number {
  const match = NOTE_PATTERN.exec(name.trim());
  const letter = match?.[1];
  const accidental = match?.[2];
  const octave = match?.[3];
  if (letter === undefined || accidental === undefined || octave === undefined) {
    throw new Error(`Not a note name: "${name}"`);
  }
  const pitchClass = PITCH_CLASSES[letter.toUpperCase()];
  if (pitchClass === undefined) throw new Error(`Not a note name: "${name}"`);
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return MIDI_C0 + Number(octave) * SEMITONES_PER_OCTAVE + pitchClass + offset;
}

/** 48 → 'C3', 42 → 'F#2'. Uses sharps. */
export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const pitchClass = ((rounded % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
  const octave = Math.floor((rounded - MIDI_C0) / SEMITONES_PER_OCTAVE);
  return `${SHARP_NAMES[pitchClass] ?? 'C'}${octave}`;
}
