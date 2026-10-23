/** Persisting the sound library. One versioned key, separate from progress. */
import { LIBRARY_SCHEMA_VERSION } from '../engine/constants';
import type { KeyValueStore } from '../storage/storage';
import { patchesEqual } from '../engine/patch';
import {
  addSound,
  deserialiseSound,
  EMPTY_LIBRARY,
  serialiseSound,
  type Library,
  type SavedSound,
  type SoundDraft,
  type Stamp,
} from './library';

export const LIBRARY_KEY = 'dialin.library';
/** Unreadable data is copied here before anything can overwrite it. */
export const LIBRARY_RESCUE_KEY_PREFIX = 'dialin.library.unreadable.';

export interface LoadedLibrary {
  readonly library: Library;
  /** Set when stored data couldn't be read; the raw data was kept under `rescueKey`. */
  readonly rescueKey?: string;
}

interface StoredLibraryV1 {
  readonly schemaVersion: 1;
  readonly savesSinceExport: number;
  readonly sounds: readonly unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Bring older stored shapes up to the current schema. There is only v1 so
 * far; future versions add a step here. Returns null if unrecognisable.
 */
function migrate(data: unknown): StoredLibraryV1 | null {
  if (!isRecord(data) || typeof data.schemaVersion !== 'number' || !Array.isArray(data.sounds)) return null;
  // Newer versions than we know are read as best we can; unknown fields are ignored.
  const savesSinceExport = typeof data.savesSinceExport === 'number' ? data.savesSinceExport : 0;
  return { schemaVersion: 1, savesSinceExport, sounds: data.sounds };
}

export function loadLibrary(store: KeyValueStore, now: number): LoadedLibrary {
  const raw = store.read(LIBRARY_KEY);
  if (raw === null) return { library: EMPTY_LIBRARY };
  let stored: StoredLibraryV1 | null = null;
  try {
    stored = migrate(JSON.parse(raw));
  } catch {
    stored = null;
  }
  if (!stored) {
    const rescueKey = `${LIBRARY_RESCUE_KEY_PREFIX}${now}`;
    store.write(rescueKey, raw);
    return { library: EMPTY_LIBRARY, rescueKey };
  }
  const sounds = stored.sounds
    .map((entry) => deserialiseSound(entry, now))
    .filter((sound): sound is SavedSound => sound !== null);
  return { library: { sounds, savesSinceExport: stored.savesSinceExport } };
}

/** Returns false if the browser refused the write. */
export function saveLibrary(store: KeyValueStore, library: Library): boolean {
  const stored = {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    savesSinceExport: library.savesSinceExport,
    sounds: library.sounds.map(serialiseSound),
  };
  return store.write(LIBRARY_KEY, JSON.stringify(stored));
}

export type KeepOutcome = 'kept' | 'already' | 'failed';

/**
 * Save a sound straight to the stored library from outside Free Play (a
 * matched round's target). Skipped if a sound with the same settings is
 * already there. Refused if the stored library can't be read, so the rescue
 * copy isn't the only one left.
 */
export function keepSound(store: KeyValueStore, draft: SoundDraft, stamp: Stamp): KeepOutcome {
  const loaded = loadLibrary(store, stamp.now);
  if (loaded.rescueKey) return 'failed';
  if (loaded.library.sounds.some((sound) => patchesEqual(sound.patch, draft.patch))) return 'already';
  return saveLibrary(store, addSound(loaded.library, draft, stamp)) ? 'kept' : 'failed';
}
