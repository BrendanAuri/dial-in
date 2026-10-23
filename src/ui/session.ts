/**
 * The Free Play working state, kept across reloads (mobile browsers often
 * reload a backgrounded tab), so unsaved tweaks aren't lost.
 */
import { DEFAULT_KEYBOARD_OCTAVE, KEYBOARD_OCTAVE_RANGE, SESSION_SCHEMA_VERSION } from '../engine/constants';
import type { Patch } from '../engine/params';
import { DEFAULT_PATCH, deserialisePatch, patchesEqual, serialisePatch } from '../engine/patch';
import type { VoiceMode } from '../engine/voiceManager';
import { cleanName } from '../library/library';
import type { KeyValueStore } from '../storage/storage';

export const SESSION_KEY = 'dialin.freeplay.session';

export interface FreePlaySession {
  readonly patch: Patch;
  /** The library sound being edited, or null for an unsaved sound. */
  readonly soundId: string | null;
  readonly soundName: string;
  /** The settings last saved or loaded, used to tell whether there are unsaved changes. */
  readonly baseline: Patch;
  readonly mode: VoiceMode;
  readonly octave: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadSession(store: KeyValueStore): FreePlaySession | null {
  const raw = store.read(SESSION_KEY);
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.schemaVersion !== 'number') return null;
  const patch = deserialisePatch(data.patch);
  if (!patch) return null;
  const [minOctave, maxOctave] = KEYBOARD_OCTAVE_RANGE;
  const octave = typeof data.octave === 'number' && Number.isInteger(data.octave) ? data.octave : null;
  return {
    patch,
    soundId: typeof data.soundId === 'string' ? data.soundId : null,
    soundName: cleanName(typeof data.soundName === 'string' ? data.soundName : ''),
    baseline: deserialisePatch(data.baseline) ?? patch,
    mode: data.mode === 'mono' ? 'mono' : 'poly',
    octave: octave === null ? DEFAULT_KEYBOARD_OCTAVE : Math.min(maxOctave, Math.max(minOctave, octave)),
  };
}

export function saveSession(store: KeyValueStore, session: FreePlaySession): boolean {
  return store.write(
    SESSION_KEY,
    JSON.stringify({
      schemaVersion: SESSION_SCHEMA_VERSION,
      patch: serialisePatch(session.patch),
      soundId: session.soundId,
      soundName: session.soundName,
      baseline: serialisePatch(session.baseline),
      mode: session.mode,
      octave: session.octave,
    }),
  );
}

/** The name of Free Play's working sound if it has unsaved changes, else null. */
export function unsavedSessionName(store: KeyValueStore): string | null {
  const session = loadSession(store);
  return session && !patchesEqual(session.patch, session.baseline) ? session.soundName : null;
}

/**
 * Make a sound Free Play's working sound, keeping its voice mode and octave.
 * Without a library id it counts as unsaved, so Free Play asks before
 * anything replaces it.
 */
export function openInFreePlay(store: KeyValueStore, sound: { readonly name: string; readonly patch: Patch; readonly id: string | null }): boolean {
  const current = loadSession(store);
  return saveSession(store, {
    patch: sound.patch,
    soundId: sound.id,
    soundName: cleanName(sound.name),
    baseline: sound.id ? sound.patch : DEFAULT_PATCH,
    mode: current?.mode ?? 'poly',
    octave: current?.octave ?? DEFAULT_KEYBOARD_OCTAVE,
  });
}
