import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FREE_PLAY_TEMPLATES } from '../../content';
import {
  DEFAULT_HOLD_TIME,
  DEFAULT_KEYBOARD_OCTAVE,
  DEFAULT_NOTE,
  KEYBOARD_OCTAVE_RANGE,
  KEYBOARD_TWO_OCTAVE_MIN_WIDTH,
  LIVE_START_DELAY,
  MAX_VOICES,
  SESSION_SAVE_DELAY_MS,
  TOAST_MS,
  UNDO_COALESCE_MS,
  UNDO_LIMIT,
} from '../../engine/constants';
import { noteNameToMidi } from '../../engine/notes';
import type { ParamId, Patch } from '../../engine/params';
import { DEFAULT_PATCH, patchesEqual, setParam } from '../../engine/patch';
import { buildVoice } from '../../engine/voice';
import { VoiceManager, type VoiceMode } from '../../engine/voiceManager';
import { packPresets } from '../../game/packs';
import { randomPatch } from '../../game/randomPatch';
import { createRng, randomSeed } from '../../game/rng';
import { newId } from '../../library/ids';
import {
  addSound,
  cleanName,
  DEFAULT_SOUND_NAME,
  deleteSound,
  duplicateSound,
  findSound,
  importSounds,
  isReadOnly,
  libraryToFile,
  markExported,
  parseSoundFile,
  soundToFile,
  syncPresets,
  toggleFavourite,
  updateSound,
  userSounds,
  type Library,
  type SavedSound,
} from '../../library/library';
import { loadLibrary, saveLibrary } from '../../library/libraryStore';
import { browserStore, requestPersistentStorage } from '../../storage/storage';
import type { LiveAudio } from '../audio';
import type { Navigate } from '../router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LibraryPanel } from '../components/LibraryPanel';
import { ShareDialog } from '../components/ShareDialog';
import { PlayDock } from '../components/PlayDock';
import { SoundDialog } from '../components/SoundDialog';
import { SynthPanel } from '../components/SynthPanel';
import { dateStamp, downloadText, fileSlug } from '../files';
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from '../history';
import { isButtonLike, isTypingTarget, useMediaQuery } from '../hooks';
import { noteForKey, OCTAVE_DOWN_KEY, OCTAVE_UP_KEY } from '../keyboardMap';
import { loadSession, saveSession, type FreePlaySession } from '../session';

const HISTORY_OPTIONS = { limit: UNDO_LIMIT, coalesceMs: UNDO_COALESCE_MS };
const STORAGE_FAILED = "Couldn't save to this browser's storage. Export your sounds to keep them safe.";

/** The sound being edited: its library id (null if unsaved), name and last-saved settings. */
interface CurrentSound {
  readonly id: string | null;
  readonly name: string;
  readonly baseline: Readonly<Patch>;
}

type DialogState =
  | { readonly kind: 'saveAs' }
  | { readonly kind: 'edit'; readonly id: string }
  | { readonly kind: 'share'; readonly name: string; readonly patch: Patch }
  | {
      readonly kind: 'confirm';
      readonly title: string;
      readonly message: string;
      readonly confirmLabel: string;
      readonly onConfirm: () => void;
    };

interface Toast {
  readonly id: number;
  readonly text: string;
}

function clampOctave(octave: number): number {
  const [min, max] = KEYBOARD_OCTAVE_RANGE;
  return Math.min(max, Math.max(min, octave));
}

interface FreePlayProps {
  readonly audio: LiveAudio;
  readonly navigate: Navigate;
}

/** The synth as an instrument: every control, a keyboard and a library of saved sounds. */
export function FreePlay({ audio, navigate }: FreePlayProps) {
  const [store] = useState(browserStore);
  const [loaded] = useState(() => {
    const stored = loadLibrary(store, Date.now());
    return { ...stored, library: syncPresets(stored.library, packPresets()) };
  });
  const [session] = useState(() => loadSession(store));

  const [history, setHistory] = useState<History<Patch>>(() =>
    createHistory(session?.patch ?? { ...DEFAULT_PATCH }),
  );
  const patch = history.present;
  const [current, setCurrent] = useState<CurrentSound>(() => ({
    id: session?.soundId && findSound(loaded.library, session.soundId) ? session.soundId : null,
    name: session?.soundName ?? DEFAULT_SOUND_NAME,
    baseline: session?.baseline ?? { ...DEFAULT_PATCH },
  }));
  const [library, setLibrary] = useState<Library>(loaded.library);
  const libraryRef = useRef(loaded.library);
  const [mode, setMode] = useState<VoiceMode>(session?.mode ?? 'poly');
  const [octave, setOctave] = useState(session?.octave ?? DEFAULT_KEYBOARD_OCTAVE);
  const [hold, setHold] = useState(false);
  const [lastNote, setLastNote] = useState(() => noteNameToMidi(DEFAULT_NOTE));
  const [pressed, setPressed] = useState<ReadonlySet<number>>(() => new Set());
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const twoOctaves = useMediaQuery(`(min-width: ${KEYBOARD_TWO_OCTAVE_MIN_WIDTH}px)`);
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');

  const [manager] = useState(
    () =>
      new VoiceManager((p, note, time) => buildVoice(audio.ctx, p, note, time, audio.output), patch, {
        maxVoices: MAX_VOICES,
        mode,
      }),
  );
  const heldNotes = useSyncExternalStore(manager.subscribe, manager.getHeldNotes);
  const dirty = !patchesEqual(patch, current.baseline);

  // ── Effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    manager.setPatch(patch, audio.ctx.currentTime);
  }, [manager, patch, audio]);

  useEffect(() => () => manager.panic(audio.ctx.currentTime), [manager, audio]);

  // Keep the working sound across reloads: debounced while editing, and at once when leaving Free Play.
  const sessionRef = useRef<FreePlaySession | null>(null);
  useEffect(() => {
    const snapshot: FreePlaySession = {
      patch,
      soundId: current.id,
      soundName: current.name,
      baseline: { ...current.baseline },
      mode,
      octave,
    };
    sessionRef.current = snapshot;
    const timer = setTimeout(() => saveSession(store, snapshot), SESSION_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [store, patch, current, mode, octave]);

  useEffect(
    () => () => {
      if (sessionRef.current) saveSession(store, sessionRef.current);
    },
    [store],
  );

  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (loaded.rescueKey) showToast("Your saved sounds couldn't be read. A copy of the data was kept.");
  }, [loaded, showToast]);

  // ── Editing ────────────────────────────────────────────────────────────

  const onParamChange = useCallback((id: ParamId, value: unknown) => {
    setHistory((h) => {
      const next = setParam(h.present, id, value);
      return patchesEqual(h.present, next) ? h : commit(h, next, id, performance.now(), HISTORY_OPTIONS);
    });
  }, []);

  const replacePatch = useCallback((next: Readonly<Patch>) => {
    setHistory((h) =>
      patchesEqual(h.present, next) ? h : commit(h, { ...next }, null, performance.now(), HISTORY_OPTIONS),
    );
  }, []);

  const onUndo = useCallback(() => setHistory(undo), []);
  const onRedo = useCallback(() => setHistory(redo), []);

  // ── Playing ────────────────────────────────────────────────────────────

  const eventTime = useCallback((): number => {
    if (audio.ctx.state !== 'running') void audio.ctx.resume();
    return audio.ctx.currentTime + LIVE_START_DELAY;
  }, [audio]);

  const noteOn = useCallback(
    (note: number) => {
      manager.noteOn(note, eventTime());
      setLastNote(note);
      setPressed((keys) => new Set(keys).add(note));
    },
    [manager, eventTime],
  );

  const noteOff = useCallback(
    (note: number) => {
      manager.noteOff(note, eventTime());
      setPressed((keys) => {
        const next = new Set(keys);
        next.delete(note);
        return next;
      });
    },
    [manager, eventTime],
  );

  /** A short note, the same length as a round's. Turns Hold off. */
  const playShort = useCallback(() => {
    const time = eventTime();
    manager.setHold(false, time);
    setHold(false);
    manager.trigger(lastNote, time, DEFAULT_HOLD_TIME);
  }, [manager, eventTime, lastNote]);

  /** Hold keeps notes sounding. Turned on with nothing playing, it sustains the last note played. */
  const toggleHold = useCallback(() => {
    const time = eventTime();
    if (hold) {
      manager.setHold(false, time);
      setHold(false);
      return;
    }
    manager.setHold(true, time);
    if (manager.getHeldNotes().length === 0) {
      manager.noteOn(lastNote, time);
      manager.noteOff(lastNote, time);
    }
    setHold(true);
  }, [manager, eventTime, hold, lastNote]);

  const onModeChange = useCallback(
    (next: VoiceMode) => {
      manager.setMode(next, eventTime());
      setMode(next);
      setHold(false);
      setPressed(new Set());
    },
    [manager, eventTime],
  );

  const onOctaveChange = useCallback((next: number) => setOctave(clampOctave(next)), []);

  // Computer keyboard: notes, octave, Space for a short note, undo / redo.
  const keyNotes = useRef(new Map<string, number>());
  const keysEnabled = !libraryOpen && dialog === null;
  useEffect(() => {
    const releaseAll = (): void => {
      for (const note of keyNotes.current.values()) noteOff(note);
      keyNotes.current.clear();
    };
    if (!keysEnabled) {
      releaseAll();
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey) {
        if (event.code === 'KeyZ') {
          event.preventDefault();
          if (event.shiftKey) onRedo();
          else onUndo();
        } else if (event.code === 'KeyY') {
          event.preventDefault();
          onRedo();
        }
        return;
      }
      if (event.altKey || event.repeat) {
        if (event.repeat && keyNotes.current.has(event.code)) event.preventDefault();
        return;
      }
      if (event.code === 'Space') {
        if (isButtonLike(event.target)) return;
        event.preventDefault();
        playShort();
      } else if (event.code === OCTAVE_DOWN_KEY) {
        setOctave((o) => clampOctave(o - 1));
      } else if (event.code === OCTAVE_UP_KEY) {
        setOctave((o) => clampOctave(o + 1));
      } else {
        const note = noteForKey(event.code, octave);
        if (note === null) return;
        event.preventDefault();
        keyNotes.current.set(event.code, note);
        noteOn(note);
      }
    }
    function onKeyUp(event: KeyboardEvent): void {
      const note = keyNotes.current.get(event.code);
      if (note === undefined) return;
      keyNotes.current.delete(event.code);
      noteOff(note);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
    };
  }, [keysEnabled, octave, noteOn, noteOff, playShort, onUndo, onRedo]);

  // ── Library ────────────────────────────────────────────────────────────

  const commitLibrary = useCallback(
    (next: Library) => {
      libraryRef.current = next;
      setLibrary(next);
      if (!saveLibrary(store, next)) showToast(STORAGE_FAILED);
    },
    [store, showToast],
  );

  /** Run `action`, first asking to discard unsaved changes if there are any. */
  const confirmDiscard = useCallback(
    (action: () => void) => {
      if (!dirty) {
        action();
        return;
      }
      setDialog({
        kind: 'confirm',
        title: 'Discard changes?',
        message: `"${current.name}" has unsaved changes. They'll be lost.`,
        confirmLabel: 'Discard',
        onConfirm: () => {
          setDialog(null);
          action();
        },
      });
    },
    [dirty, current.name],
  );

  const onNew = useCallback(() => {
    confirmDiscard(() => {
      replacePatch(DEFAULT_PATCH);
      setCurrent({ id: null, name: DEFAULT_SOUND_NAME, baseline: { ...DEFAULT_PATCH } });
    });
  }, [confirmDiscard, replacePatch]);

  // Randomise keeps your tempo, so synced sounds stay in time with what you're making.
  const tempo = patch['lfo.tempo'];
  const onRandomise = useCallback(
    () => replacePatch(randomPatch(createRng(randomSeed()), FREE_PLAY_TEMPLATES, { ...DEFAULT_PATCH, 'lfo.tempo': tempo })),
    [replacePatch, tempo],
  );

  const onSave = useCallback(() => {
    const sound = current.id ? findSound(libraryRef.current, current.id) : undefined;
    if (!sound || isReadOnly(sound)) {
      setDialog({ kind: 'saveAs' });
      return;
    }
    commitLibrary(updateSound(libraryRef.current, sound.id, { patch }, Date.now()));
    setCurrent((c) => ({ ...c, baseline: { ...patch } }));
    void requestPersistentStorage();
    showToast(`Saved "${sound.name}"`);
  }, [current.id, patch, commitLibrary, showToast]);

  const onSaveAs = useCallback(
    (name: string, tags: string[]) => {
      const id = newId();
      commitLibrary(addSound(libraryRef.current, { name, tags, patch }, { id, now: Date.now() }));
      setCurrent({ id, name: cleanName(name), baseline: { ...patch } });
      setDialog(null);
      void requestPersistentStorage();
      showToast(`Saved "${cleanName(name)}"`);
    },
    [patch, commitLibrary, showToast],
  );

  const onEditDetails = useCallback(
    (id: string, name: string, tags: string[]) => {
      commitLibrary(updateSound(libraryRef.current, id, { name, tags }, Date.now()));
      setCurrent((c) => (c.id === id ? { ...c, name: cleanName(name) } : c));
      setDialog(null);
    },
    [commitLibrary],
  );

  const onLoad = useCallback(
    (sound: SavedSound) => {
      confirmDiscard(() => {
        replacePatch(sound.patch);
        setCurrent({ id: sound.id, name: sound.name, baseline: { ...sound.patch } });
        setLibraryOpen(false);
        showToast(`Loaded "${sound.name}"`);
      });
    },
    [confirmDiscard, replacePatch, showToast],
  );

  const onDuplicate = useCallback(
    (id: string) => {
      commitLibrary(duplicateSound(libraryRef.current, id, { id: newId(), now: Date.now() }));
      showToast('Duplicated');
    },
    [commitLibrary, showToast],
  );

  const onDelete = useCallback(
    (id: string) => {
      const sound = findSound(libraryRef.current, id);
      if (!sound) return;
      setDialog({
        kind: 'confirm',
        title: 'Delete sound?',
        message: `"${sound.name}" will be deleted from this browser. This can't be undone.`,
        confirmLabel: 'Delete',
        onConfirm: () => {
          commitLibrary(deleteSound(libraryRef.current, id));
          // The open sound stays on screen, now unsaved.
          setCurrent((c) => (c.id === id ? { ...c, id: null, baseline: { ...DEFAULT_PATCH } } : c));
          setDialog(null);
          showToast(`Deleted "${sound.name}"`);
        },
      });
    },
    [commitLibrary, showToast],
  );

  const onFavourite = useCallback(
    (id: string) => commitLibrary(toggleFavourite(libraryRef.current, id)),
    [commitLibrary],
  );

  const onExportAll = useCallback(() => {
    const now = Date.now();
    downloadText(`dial-in-sounds-${dateStamp(now)}.json`, libraryToFile(libraryRef.current, now));
    commitLibrary(markExported(libraryRef.current));
  }, [commitLibrary]);

  const onExportOne = useCallback((id: string) => {
    const sound = findSound(libraryRef.current, id);
    if (sound) downloadText(`${fileSlug(sound.name)}.dialin.json`, soundToFile(sound));
  }, []);

  const onImport = useCallback(
    (file: File) => {
      void file.text().then(
        (text) => {
          const parsed = parseSoundFile(text, Date.now());
          if (!parsed) {
            showToast("That file isn't a Dial In sound or library.");
            return;
          }
          const result = importSounds(libraryRef.current, parsed.sounds, newId);
          commitLibrary(result.library);
          const notes = [
            `Imported ${result.added} sound${result.added === 1 ? '' : 's'}`,
            result.skipped > 0 ? `${result.skipped} already here` : null,
            parsed.invalid > 0 ? `${parsed.invalid} unreadable` : null,
          ].filter((note) => note !== null);
          showToast(notes.join(' · '));
        },
        () => showToast("Couldn't read that file."),
      );
    },
    [commitLibrary, showToast],
  );

  const onDismissBackup = useCallback(() => commitLibrary(markExported(libraryRef.current)), [commitLibrary]);

  // ── Render ─────────────────────────────────────────────────────────────

  const activeNotes = new Set([...pressed, ...heldNotes]);
  const editing = dialog?.kind === 'edit' ? findSound(library, dialog.id) : undefined;
  const userCount = userSounds(library).length;

  return (
    <div className="screen free-play">
      <header className="top-bar">
        <h1 className="visually-hidden">Free Play</h1>
        <div className="sound-title">
          <span className="sound-title-name">{current.name}</span>
          {dirty && (
            <span className="dirty" title="Unsaved changes">
              <span aria-hidden="true">•</span>
              <span className="visually-hidden">(unsaved changes)</span>
            </span>
          )}
        </div>
      </header>

      <div className="toolbar" role="toolbar" aria-label="Sound">
        <div className="toolbar-group">
          <button type="button" className="button" onClick={onUndo} disabled={!canUndo(history)} title="Undo (Ctrl+Z)" aria-label="Undo">
            ↶<span className="toolbar-label"> Undo</span>
          </button>
          <button type="button" className="button" onClick={onRedo} disabled={!canRedo(history)} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
            ↷<span className="toolbar-label"> Redo</span>
          </button>
          <button type="button" className="button" onClick={onNew} title="Start a new sound from the init patch">
            New
          </button>
          <button type="button" className="button" onClick={onRandomise}>
            Randomise
          </button>
        </div>
        <div className="toolbar-group">
          <button type="button" className="button primary" onClick={onSave}>
            Save
          </button>
          <button type="button" className="button" onClick={() => setLibraryOpen(true)}>
            Sounds{userCount > 0 ? ` (${userCount})` : ''}
          </button>
          <button type="button" className="button" onClick={() => setDialog({ kind: 'share', name: current.name, patch })}>
            Share
          </button>
        </div>
      </div>

      <SynthPanel patch={patch} onChange={onParamChange} />

      <p className="hint">
        {canHover
          ? 'Keys A–K play notes · Z / X change octave · Space plays a short note · Shift-drag a knob for fine control · double-click a knob to reset'
          : 'Drag knobs up and down · double-tap a knob to reset · turn on Hold to hear changes live'}
      </p>

      <PlayDock
        analyser={audio.analyser}
        lastNote={lastNote}
        hold={hold}
        mode={mode}
        octave={octave}
        octaves={twoOctaves ? 2 : 1}
        activeNotes={activeNotes}
        showKeyHints={canHover}
        onPlay={playShort}
        onToggleHold={toggleHold}
        onModeChange={onModeChange}
        onOctaveChange={onOctaveChange}
        onNoteOn={noteOn}
        onNoteOff={noteOff}
      />

      {libraryOpen && (
        <LibraryPanel
          library={library}
          currentId={current.id}
          onClose={() => setLibraryOpen(false)}
          onLoad={onLoad}
          onEdit={(id) => setDialog({ kind: 'edit', id })}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onFavourite={onFavourite}
          onExportOne={onExportOne}
          onShare={(sound) => {
            setLibraryOpen(false);
            setDialog({ kind: 'share', name: sound.name, patch: sound.patch });
          }}
          onExportAll={onExportAll}
          onImport={onImport}
          onDismissBackup={onDismissBackup}
        />
      )}

      {dialog?.kind === 'saveAs' && (
        <SoundDialog
          title="Save sound"
          submitLabel="Save"
          initialName={current.id === null && current.name === DEFAULT_SOUND_NAME ? '' : current.name}
          initialTags={[]}
          onSubmit={onSaveAs}
          onCancel={() => setDialog(null)}
        />
      )}
      {editing && (
        <SoundDialog
          title="Rename sound"
          submitLabel="Save"
          initialName={editing.name}
          initialTags={editing.tags}
          onSubmit={(name, tags) => onEditDetails(editing.id, name, tags)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'share' && (
        <ShareDialog name={dialog.name} patch={dialog.patch} onClose={() => setDialog(null)} onTry={(route) => navigate(route)} />
      )}
      {dialog?.kind === 'confirm' && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          destructive
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
        />
      )}

      <div className="toast-region" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}
