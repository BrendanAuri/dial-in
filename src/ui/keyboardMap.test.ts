import { describe, expect, it } from 'vitest';
import { keyLabelForOffset, lowestNoteForOctave, noteForKey } from './keyboardMap';

describe('computer keyboard', () => {
  it('maps the A row to white keys and the row above to black keys', () => {
    expect(noteForKey('KeyA', 3)).toBe(48);
    expect(noteForKey('KeyW', 3)).toBe(49);
    expect(noteForKey('KeyD', 3)).toBe(52);
    expect(noteForKey('KeyK', 3)).toBe(60);
    expect(noteForKey('KeyA', 4)).toBe(60);
  });

  it('ignores other keys', () => {
    expect(noteForKey('KeyQ', 3)).toBeNull();
    expect(noteForKey('Space', 3)).toBeNull();
  });

  it('labels keys and finds octave starts', () => {
    expect(keyLabelForOffset(0)).toBe('A');
    expect(keyLabelForOffset(10)).toBe('U');
    expect(keyLabelForOffset(13)).toBeNull();
    expect(lowestNoteForOctave(3)).toBe(48);
  });
});
