import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_HOLD_TIME, DEFAULT_NOTE, LIVE_START_DELAY, NOTE_PICKER_RANGE } from '../../engine/constants';
import { midiToNoteName, noteNameToMidi } from '../../engine/notes';
import { MODULES, paramsInModule, type ParamId, type Patch } from '../../engine/params';
import { DEFAULT_PATCH, setParam } from '../../engine/patch';
import { buildVoice, type VoiceHandle } from '../../engine/voice';
import type { LiveAudio } from '../audio';
import { ParamControl } from '../components/ParamControl';

const LOWEST_NOTE = noteNameToMidi(NOTE_PICKER_RANGE[0]);
const HIGHEST_NOTE = noteNameToMidi(NOTE_PICKER_RANGE[1]);
const NOTE_CHOICES = Array.from({ length: HIGHEST_NOTE - LOWEST_NOTE + 1 }, (_, i) => LOWEST_NOTE + i);

function isTextOrButton(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, select, input, textarea') !== null;
}

interface FreePlayProps {
  readonly audio: LiveAudio;
}

/**
 * Milestone 1 test bench: every control and a Play button. Grows into the
 * full Free Play screen (keyboard, library) in Milestone 2.
 */
export function FreePlay({ audio }: FreePlayProps) {
  const [patch, setPatch] = useState<Patch>(() => ({ ...DEFAULT_PATCH }));
  const [note, setNote] = useState(() => noteNameToMidi(DEFAULT_NOTE));
  const [playing, setPlaying] = useState(false);
  const voiceRef = useRef<VoiceHandle | null>(null);
  const patchRef = useRef(patch);

  // Knob changes are heard on a note that's already playing.
  useEffect(() => {
    patchRef.current = patch;
    voiceRef.current?.update(patch, audio.ctx.currentTime);
  }, [patch, audio]);

  const play = useCallback(() => {
    const { ctx, output } = audio;
    if (ctx.state !== 'running') void ctx.resume();
    const now = ctx.currentTime;
    voiceRef.current?.stop(now);
    const start = now + LIVE_START_DELAY;
    const voice = buildVoice(ctx, patchRef.current, note, start, output);
    voice.release(start + DEFAULT_HOLD_TIME);
    voiceRef.current = voice;
    setPlaying(true);
    void voice.ended.then(() => {
      if (voiceRef.current !== voice) return;
      voiceRef.current = null;
      setPlaying(false);
    });
  }, [audio, note]);

  // Space plays, unless a button or form field has focus.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code !== 'Space' || event.repeat || isTextOrButton(event.target)) return;
      event.preventDefault();
      play();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [play]);

  const onParamChange = useCallback((id: ParamId, value: unknown) => {
    setPatch((current) => setParam(current, id, value));
  }, []);

  return (
    <div className="free-play">
      <header className="top-bar">
        <h1 className="top-bar-title">Dial In</h1>
        <span className="top-bar-subtitle">Free Play · test bench</span>
      </header>

      <div className="transport">
        <button
          type="button"
          className={playing ? 'button primary play playing' : 'button primary play'}
          onClick={play}
        >
          ▶ Play
        </button>
        <label className="note-picker">
          <span>Note</span>
          <select value={note} onChange={(event) => setNote(Number(event.target.value))}>
            {NOTE_CHOICES.map((midi) => (
              <option key={midi} value={midi}>
                {midiToNoteName(midi)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button" onClick={() => setPatch({ ...DEFAULT_PATCH })}>
          Init
        </button>
      </div>

      <main className="modules">
        {MODULES.map((module) => (
          <section key={module.id} className="module" aria-labelledby={`module-${module.id}`}>
            <h2 id={`module-${module.id}`} className="module-title">
              {module.label}
            </h2>
            <div className="module-controls">
              {paramsInModule(module.id).map((id) => (
                <ParamControl key={id} id={id} patch={patch} onChange={onParamChange} />
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="hint">
        Drag knobs up and down · Shift for fine control · double-tap to reset · Space to play
      </footer>
    </div>
  );
}
