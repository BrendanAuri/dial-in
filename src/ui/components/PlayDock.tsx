import { KEYBOARD_OCTAVE_RANGE } from '../../engine/constants';
import { midiToNoteName } from '../../engine/notes';
import type { VoiceMode } from '../../engine/voiceManager';
import { lowestNoteForOctave } from '../keyboardMap';
import { Keyboard } from './Keyboard';
import { Selector } from './Selector';

const MODE_OPTIONS = [
  { value: 'poly', label: 'Poly' },
  { value: 'mono', label: 'Mono' },
] as const;

interface PlayDockProps {
  readonly lastNote: number;
  readonly hold: boolean;
  readonly mode: VoiceMode;
  readonly octave: number;
  readonly octaves: number;
  readonly activeNotes: ReadonlySet<number>;
  readonly showKeyHints: boolean;
  readonly onPlay: () => void;
  readonly onToggleHold: () => void;
  readonly onModeChange: (mode: VoiceMode) => void;
  readonly onOctaveChange: (octave: number) => void;
  readonly onNoteOn: (note: number) => void;
  readonly onNoteOff: (note: number) => void;
}

/** Bottom dock: Play / Hold, voice mode, octave and the on-screen keyboard. */
export function PlayDock(props: PlayDockProps) {
  const { lastNote, hold, mode, octave, octaves, onOctaveChange } = props;
  const [minOctave, maxOctave] = KEYBOARD_OCTAVE_RANGE;
  const noteName = midiToNoteName(lastNote);
  return (
    <div className="dock">
      <div className="dock-controls">
        <button
          type="button"
          className="button primary play"
          onClick={props.onPlay}
          title={`Play ${noteName} briefly (Space)`}
        >
          ▶ Play <span className="play-note">{noteName}</span>
        </button>
        <button
          type="button"
          className={hold ? 'button hold on' : 'button hold'}
          aria-pressed={hold}
          onClick={props.onToggleHold}
          title="Keep notes sounding so you can hear knob changes live"
        >
          Hold
        </button>
        <Selector label="Voice mode" hideLabel options={MODE_OPTIONS} value={mode} onChange={props.onModeChange} />
        <div className="octave" role="group" aria-label="Keyboard octave">
          <button
            type="button"
            className="button icon"
            aria-label="Octave down (Z)"
            disabled={octave <= minOctave}
            onClick={() => onOctaveChange(octave - 1)}
          >
            −
          </button>
          <span className="octave-label">{midiToNoteName(lowestNoteForOctave(octave))}</span>
          <button
            type="button"
            className="button icon"
            aria-label="Octave up (X)"
            disabled={octave >= maxOctave}
            onClick={() => onOctaveChange(octave + 1)}
          >
            +
          </button>
        </div>
      </div>
      <Keyboard
        lowestNote={lowestNoteForOctave(octave)}
        octaves={octaves}
        activeNotes={props.activeNotes}
        showKeyHints={props.showKeyHints}
        onNoteOn={props.onNoteOn}
        onNoteOff={props.onNoteOff}
      />
    </div>
  );
}
