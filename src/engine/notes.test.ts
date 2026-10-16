import { describe, expect, it } from 'vitest';
import { midiToHz, midiToNoteName, noteNameToMidi } from './notes';

describe('notes', () => {
  it('tunes A4 to 440 Hz and doubles per octave', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(57)).toBeCloseTo(220);
    expect(midiToHz(60)).toBeCloseTo(261.626, 3);
  });

  it('parses note names with C4 as middle C', () => {
    expect(noteNameToMidi('C4')).toBe(60);
    expect(noteNameToMidi('C3')).toBe(48);
    expect(noteNameToMidi('C1')).toBe(24);
    expect(noteNameToMidi('F#2')).toBe(42);
    expect(noteNameToMidi('Bb4')).toBe(70);
    expect(noteNameToMidi('a4')).toBe(69);
  });

  it('rejects anything that is not a note name', () => {
    expect(() => noteNameToMidi('H2')).toThrow();
    expect(() => noteNameToMidi('C')).toThrow();
    expect(() => noteNameToMidi('')).toThrow();
  });

  it('names MIDI notes using sharps', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(42)).toBe('F#2');
    expect(midiToNoteName(24)).toBe('C1');
    for (let midi = 12; midi <= 108; midi++) expect(noteNameToMidi(midiToNoteName(midi))).toBe(midi);
  });
});
