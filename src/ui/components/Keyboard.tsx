import { useRef, type PointerEvent } from 'react';
import { SEMITONES_PER_OCTAVE } from '../../engine/constants';
import { midiToNoteName } from '../../engine/notes';
import { keyLabelForOffset } from '../keyboardMap';

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
/** Black key width as a fraction of a white key. */
const BLACK_KEY_WIDTH_RATIO = 0.6;

function isBlack(note: number): boolean {
  return BLACK_PITCH_CLASSES.has(((note % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE);
}

interface KeyboardProps {
  /** MIDI note of the lowest key; should be a C. */
  readonly lowestNote: number;
  readonly octaves: number;
  readonly activeNotes: ReadonlySet<number>;
  /** Show the computer-keyboard letter on each key. */
  readonly showKeyHints: boolean;
  readonly onNoteOn: (note: number) => void;
  readonly onNoteOff: (note: number) => void;
}

/** On-screen piano. Multi-touch: each finger plays its own key. */
export function Keyboard({ lowestNote, octaves, activeNotes, showKeyHints, onNoteOn, onNoteOff }: KeyboardProps) {
  const pointers = useRef(new Map<number, number>());

  const notes = Array.from({ length: octaves * SEMITONES_PER_OCTAVE + 1 }, (_, i) => lowestNote + i);
  const whites = notes.filter((note) => !isBlack(note));
  const whiteWidth = 100 / whites.length;
  const blackWidth = whiteWidth * BLACK_KEY_WIDTH_RATIO;

  function press(event: PointerEvent<HTMLDivElement>, note: number): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, note);
    onNoteOn(note);
  }

  function lift(event: PointerEvent<HTMLDivElement>): void {
    const note = pointers.current.get(event.pointerId);
    if (note === undefined) return;
    pointers.current.delete(event.pointerId);
    onNoteOff(note);
  }

  function keyProps(note: number) {
    const offset = note - lowestNote;
    const hint = showKeyHints && offset <= SEMITONES_PER_OCTAVE ? keyLabelForOffset(offset) : null;
    return {
      className: `key ${isBlack(note) ? 'black' : 'white'}${activeNotes.has(note) ? ' active' : ''}`,
      'data-note': midiToNoteName(note),
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => press(event, note),
      onPointerUp: lift,
      onPointerCancel: lift,
      onLostPointerCapture: lift,
      children: (
        <>
          {hint && <span className="key-hint">{hint}</span>}
          {note % SEMITONES_PER_OCTAVE === 0 && <span className="key-name">{midiToNoteName(note)}</span>}
        </>
      ),
    };
  }

  return (
    <div
      className="keyboard"
      role="group"
      aria-label="Keyboard. On a computer, keys A to K play notes."
      onContextMenu={(event) => event.preventDefault()}
    >
      {whites.map((note, i) => (
        <div key={note} {...keyProps(note)} style={{ left: `${i * whiteWidth}%`, width: `${whiteWidth}%` }} />
      ))}
      {notes.filter(isBlack).map((note) => {
        const whiteBelow = whites.indexOf(note - 1);
        return (
          <div
            key={note}
            {...keyProps(note)}
            style={{ left: `${(whiteBelow + 1) * whiteWidth - blackWidth / 2}%`, width: `${blackWidth}%` }}
          />
        );
      })}
    </div>
  );
}
