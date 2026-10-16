/**
 * The Free Play sound library: pure operations on an immutable list of
 * saved sounds, plus the JSON file format for export and import.
 */
import {
  LIBRARY_SCHEMA_VERSION,
  SOUND_MAX_TAGS,
  SOUND_NAME_MAX_LENGTH,
  SOUND_TAG_MAX_LENGTH,
} from '../engine/constants';
import type { Patch } from '../engine/params';
import { deserialisePatch, patchesEqual, serialisePatch, type SerialisedPatch } from '../engine/patch';

/** 'user' for the player's own sounds; 'preset:<packId>' for a pack's factory sounds. */
export type SoundSource = 'user' | `preset:${string}`;

export interface SavedSound {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly favourite: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly source: SoundSource;
  readonly patch: Readonly<Patch>;
}

export interface Library {
  readonly sounds: readonly SavedSound[];
  /** Saves since the last export, for the backup reminder. */
  readonly savesSinceExport: number;
}

export const EMPTY_LIBRARY: Library = { sounds: [], savesSinceExport: 0 };

export const DEFAULT_SOUND_NAME = 'Untitled';

/** Fresh ids and timestamps, injected so the operations stay pure. */
export interface Stamp {
  readonly id: string;
  readonly now: number;
}

export interface SoundDraft {
  readonly name: string;
  readonly tags: readonly string[];
  readonly patch: Readonly<Patch>;
}

// ── Names and tags ───────────────────────────────────────────────────────

/** Trim, collapse whitespace and cap the length. Empty names become "Untitled". */
export function cleanName(name: string): string {
  const cleaned = name.replace(/\s+/g, ' ').trim().slice(0, SOUND_NAME_MAX_LENGTH).trim();
  return cleaned === '' ? DEFAULT_SOUND_NAME : cleaned;
}

/** Tidy a list of tags: trimmed, lower case, no duplicates, capped in length and number. */
export function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const cleaned = tag.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, SOUND_TAG_MAX_LENGTH).trim();
    if (cleaned !== '') seen.add(cleaned);
  }
  return [...seen].slice(0, SOUND_MAX_TAGS);
}

/** "bass, dark ,Bass" → ['bass', 'dark']. */
export function parseTags(input: string): string[] {
  return cleanTags(input.split(','));
}

export function isReadOnly(sound: SavedSound): boolean {
  return sound.source !== 'user';
}

// ── Operations ───────────────────────────────────────────────────────────

export function findSound(library: Library, id: string): SavedSound | undefined {
  return library.sounds.find((sound) => sound.id === id);
}

export function addSound(library: Library, draft: SoundDraft, stamp: Stamp): Library {
  const sound: SavedSound = {
    id: stamp.id,
    name: cleanName(draft.name),
    tags: cleanTags(draft.tags),
    favourite: false,
    createdAt: stamp.now,
    updatedAt: stamp.now,
    source: 'user',
    patch: { ...draft.patch },
  };
  return { sounds: [...library.sounds, sound], savesSinceExport: library.savesSinceExport + 1 };
}

export interface SoundChanges {
  readonly name?: string;
  readonly tags?: readonly string[];
  readonly patch?: Readonly<Patch>;
}

/** Change a user sound's name, tags or patch. Read-only sounds and unknown ids are left alone. */
export function updateSound(library: Library, id: string, changes: SoundChanges, now: number): Library {
  const sound = findSound(library, id);
  if (!sound || isReadOnly(sound)) return library;
  const updated: SavedSound = {
    ...sound,
    name: changes.name === undefined ? sound.name : cleanName(changes.name),
    tags: changes.tags === undefined ? sound.tags : cleanTags(changes.tags),
    patch: changes.patch === undefined ? sound.patch : { ...changes.patch },
    updatedAt: now,
  };
  return {
    sounds: library.sounds.map((s) => (s.id === id ? updated : s)),
    savesSinceExport: library.savesSinceExport + (changes.patch === undefined ? 0 : 1),
  };
}

export function toggleFavourite(library: Library, id: string): Library {
  return {
    ...library,
    sounds: library.sounds.map((s) => (s.id === id ? { ...s, favourite: !s.favourite } : s)),
  };
}

/** Delete a user sound. Read-only sounds can't be deleted. */
export function deleteSound(library: Library, id: string): Library {
  const sound = findSound(library, id);
  if (!sound || isReadOnly(sound)) return library;
  return { ...library, sounds: library.sounds.filter((s) => s.id !== id) };
}

/** Copy any sound (including a preset) as a new user sound named "<name> copy". */
export function duplicateSound(library: Library, id: string, stamp: Stamp): Library {
  const sound = findSound(library, id);
  if (!sound) return library;
  return addSound(library, { name: `${sound.name} copy`, tags: sound.tags, patch: sound.patch }, stamp);
}

export function markExported(library: Library): Library {
  return { ...library, savesSinceExport: 0 };
}

// ── Searching ────────────────────────────────────────────────────────────

export type SortOrder = 'recent' | 'name';

export interface SoundQuery {
  readonly search: string;
  readonly sort: SortOrder;
  readonly favouritesOnly: boolean;
}

/** Every word of the search must appear in the name or a tag. */
export function querySounds(library: Library, query: SoundQuery): SavedSound[] {
  const words = query.search.toLowerCase().split(/\s+/).filter((w) => w !== '');
  const matches = library.sounds.filter((sound) => {
    if (query.favouritesOnly && !sound.favourite) return false;
    const haystack = [sound.name, ...sound.tags].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  return matches.sort((a, b) =>
    query.sort === 'name'
      ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || b.updatedAt - a.updatedAt
      : b.updatedAt - a.updatedAt,
  );
}

// ── Serialisation (shared by storage and files) ──────────────────────────

export interface SerialisedSound {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly favourite: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly source: SoundSource;
  readonly patch: SerialisedPatch;
}

export function serialiseSound(sound: SavedSound): SerialisedSound {
  return { ...sound, tags: [...sound.tags], patch: serialisePatch(sound.patch) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSource(value: unknown): value is SoundSource {
  return value === 'user' || (typeof value === 'string' && value.startsWith('preset:') && value.length > 7);
}

/** Read one stored or exported sound. Returns null if it has no usable patch. */
export function deserialiseSound(data: unknown, fallbackNow: number): SavedSound | null {
  if (!isRecord(data)) return null;
  const patch = deserialisePatch(data.patch);
  if (!patch || typeof data.id !== 'string' || data.id === '') return null;
  const tags = Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === 'string') : [];
  const createdAt = typeof data.createdAt === 'number' && Number.isFinite(data.createdAt) ? data.createdAt : fallbackNow;
  const updatedAt = typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : createdAt;
  return {
    id: data.id,
    name: cleanName(typeof data.name === 'string' ? data.name : ''),
    tags: cleanTags(tags),
    favourite: data.favourite === true,
    createdAt,
    updatedAt,
    source: isSource(data.source) ? data.source : 'user',
    patch,
  };
}

// ── Files ────────────────────────────────────────────────────────────────

export const LIBRARY_FILE_KIND = 'dial-in/library';
export const SOUND_FILE_KIND = 'dial-in/sound';

export function libraryToFile(library: Library, now: number): string {
  return JSON.stringify(
    {
      kind: LIBRARY_FILE_KIND,
      v: LIBRARY_SCHEMA_VERSION,
      exportedAt: new Date(now).toISOString(),
      sounds: library.sounds.map(serialiseSound),
    },
    null,
    2,
  );
}

export function soundToFile(sound: SavedSound): string {
  return JSON.stringify({ kind: SOUND_FILE_KIND, v: LIBRARY_SCHEMA_VERSION, sound: serialiseSound(sound) }, null, 2);
}

export interface ParsedFile {
  readonly sounds: readonly SavedSound[];
  /** Entries in the file that couldn't be read. */
  readonly invalid: number;
}

/** Read a library or single-sound file. Returns null if it isn't a Dial In file at all. */
export function parseSoundFile(json: string, now: number): ParsedFile | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  let entries: unknown[];
  if (data.kind === LIBRARY_FILE_KIND && Array.isArray(data.sounds)) entries = data.sounds;
  else if (data.kind === SOUND_FILE_KIND) entries = [data.sound];
  else return null;
  const sounds = entries.map((entry) => deserialiseSound(entry, now)).filter((s): s is SavedSound => s !== null);
  return { sounds, invalid: entries.length - sounds.length };
}

export interface ImportResult {
  readonly library: Library;
  readonly added: number;
  /** Sounds already in the library (same name and settings). */
  readonly skipped: number;
}

/**
 * Add imported sounds as new user sounds with fresh ids. A sound with the
 * same name and settings as one already in the library is skipped.
 */
export function importSounds(library: Library, sounds: readonly SavedSound[], newId: () => string): ImportResult {
  const result: SavedSound[] = [...library.sounds];
  let added = 0;
  let skipped = 0;
  for (const sound of sounds) {
    const duplicate = result.some((s) => s.name === sound.name && patchesEqual(s.patch, sound.patch));
    if (duplicate) {
      skipped++;
      continue;
    }
    result.push({ ...sound, id: newId(), source: 'user' });
    added++;
  }
  return { library: { ...library, sounds: result }, added, skipped };
}
