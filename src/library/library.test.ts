import { describe, expect, it } from 'vitest';
import type { Patch } from '../engine/params';
import { DEFAULT_PATCH } from '../engine/patch';
import {
  addSound,
  cleanName,
  cleanTags,
  deleteSound,
  duplicateSound,
  EMPTY_LIBRARY,
  findSound,
  importSounds,
  libraryToFile,
  markExported,
  parseSoundFile,
  parseTags,
  querySounds,
  soundToFile,
  toggleFavourite,
  updateSound,
  syncPresets,
  userSounds,
  type PresetSound,
  type Library,
  type SavedSound,
} from './library';

const bass: Patch = { ...DEFAULT_PATCH, 'osc.octave': -1, 'filter.cutoff': 300 };
const pad: Patch = { ...DEFAULT_PATCH, 'amp.attack': 1.2, 'amp.release': 2 };

function ids(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

function sample(): Library {
  let library = addSound(EMPTY_LIBRARY, { name: 'Deep Sub', tags: ['bass'], patch: bass }, { id: 'a', now: 1000 });
  library = addSound(library, { name: 'airy pad', tags: ['pad', 'soft'], patch: pad }, { id: 'b', now: 2000 });
  return library;
}

function sound(library: Library, id: string): SavedSound {
  const found = findSound(library, id);
  if (!found) throw new Error(`no sound ${id}`);
  return found;
}

describe('names and tags', () => {
  it('tidies names and falls back to Untitled', () => {
    expect(cleanName('  Big   Reese ')).toBe('Big Reese');
    expect(cleanName('   ')).toBe('Untitled');
    expect(cleanName('x'.repeat(200))).toHaveLength(60);
  });

  it('tidies tags', () => {
    expect(parseTags('Bass, dark ,bass,, ')).toEqual(['bass', 'dark']);
    expect(cleanTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(8);
  });
});

describe('operations', () => {
  it('adds sounds as user sounds and counts saves', () => {
    const library = sample();
    expect(library.sounds).toHaveLength(2);
    expect(sound(library, 'a')).toMatchObject({ name: 'Deep Sub', source: 'user', favourite: false, createdAt: 1000 });
    expect(library.savesSinceExport).toBe(2);
  });

  it('updates a sound without touching the others', () => {
    const before = sample();
    const after = updateSound(before, 'a', { patch: pad, name: 'Sub 2' }, 5000);
    expect(sound(after, 'a')).toMatchObject({ name: 'Sub 2', patch: pad, updatedAt: 5000, createdAt: 1000 });
    expect(sound(after, 'b')).toBe(sound(before, 'b'));
    expect(after.savesSinceExport).toBe(3);
    expect(updateSound(before, 'a', { name: 'Renamed' }, 5000).savesSinceExport).toBe(2);
  });

  it('refuses to change or delete presets', () => {
    const library: Library = {
      ...sample(),
      sounds: [...sample().sounds, { ...sound(sample(), 'a'), id: 'p', source: 'preset:bass' }],
    };
    expect(updateSound(library, 'p', { name: 'Mine now' }, 9)).toBe(library);
    expect(deleteSound(library, 'p')).toBe(library);
    const copied = duplicateSound(library, 'p', { id: 'c', now: 9 });
    expect(sound(copied, 'c')).toMatchObject({ name: 'Deep Sub copy', source: 'user' });
  });

  it('deletes, duplicates and favourites', () => {
    const library = sample();
    expect(deleteSound(library, 'a').sounds.map((s) => s.id)).toEqual(['b']);
    expect(sound(duplicateSound(library, 'b', { id: 'c', now: 3000 }), 'c').name).toBe('airy pad copy');
    expect(sound(toggleFavourite(library, 'b'), 'b').favourite).toBe(true);
    expect(sound(toggleFavourite(toggleFavourite(library, 'b'), 'b'), 'b').favourite).toBe(false);
    expect(markExported(library).savesSinceExport).toBe(0);
  });
});

describe('querySounds', () => {
  const library = toggleFavourite(sample(), 'a');

  it('sorts by most recently updated or by name', () => {
    expect(querySounds(library, { search: '', sort: 'recent', favouritesOnly: false }).map((s) => s.id)).toEqual(['b', 'a']);
    expect(querySounds(library, { search: '', sort: 'name', favouritesOnly: false }).map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('searches names and tags, case-insensitively, matching every word', () => {
    expect(querySounds(library, { search: 'SUB', sort: 'recent', favouritesOnly: false }).map((s) => s.id)).toEqual(['a']);
    expect(querySounds(library, { search: 'soft', sort: 'recent', favouritesOnly: false }).map((s) => s.id)).toEqual(['b']);
    expect(querySounds(library, { search: 'pad bass', sort: 'recent', favouritesOnly: false })).toEqual([]);
  });

  it('filters favourites', () => {
    expect(querySounds(library, { search: '', sort: 'recent', favouritesOnly: true }).map((s) => s.id)).toEqual(['a']);
  });
});

describe('files', () => {
  it('round-trips a library through a file', () => {
    const library = sample();
    const parsed = parseSoundFile(libraryToFile(library, 0), 0);
    expect(parsed?.invalid).toBe(0);
    expect(parsed?.sounds).toEqual(library.sounds);
  });

  it('reads a single-sound file', () => {
    const parsed = parseSoundFile(soundToFile(sound(sample(), 'a')), 0);
    expect(parsed?.sounds).toHaveLength(1);
    expect(parsed?.sounds[0]?.patch).toEqual(bass);
  });

  it('counts unreadable entries and rejects files that are not ours', () => {
    const json = JSON.stringify({ kind: 'dial-in/library', v: 1, sounds: [{ id: 'x' }, 42] });
    expect(parseSoundFile(json, 0)).toEqual({ sounds: [], invalid: 2 });
    expect(parseSoundFile('{"hello": 1}', 0)).toBeNull();
    expect(parseSoundFile('not json', 0)).toBeNull();
  });

  it('imports as new user sounds and skips ones already present', () => {
    const library = sample();
    const incoming = [
      sound(library, 'a'),
      { ...sound(library, 'b'), name: 'airy pad (v2)', source: 'preset:pads' as const },
    ];
    const result = importSounds(library, incoming, ids());
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(sound(result.library, 'id-1')).toMatchObject({ name: 'airy pad (v2)', source: 'user' });
  });
});

describe('factory presets', () => {
  const reese: PresetSound = { id: 'bass/reese', source: 'preset:bass', name: 'Reese', tags: ['bass'], patch: bass };
  const stab: PresetSound = { id: 'bass/stab', source: 'preset:bass', name: 'Stab', tags: ['bass'], patch: pad };

  it('adds shipped presets alongside your own sounds, read-only', () => {
    const library = syncPresets(sample(), [reese, stab]);
    expect(library.sounds.map((s) => s.id)).toEqual(['a', 'b', 'bass/reese', 'bass/stab']);
    expect(sound(library, 'bass/reese').source).toBe('preset:bass');
    expect(updateSound(library, 'bass/reese', { name: 'Mine' }, 1)).toBe(library);
    expect(userSounds(library).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('returns the same library when nothing changed', () => {
    const library = syncPresets(sample(), [reese]);
    expect(syncPresets(library, [reese])).toBe(library);
  });

  it('refreshes changed presets, keeps favourites and drops ones no longer shipped', () => {
    const library = toggleFavourite(syncPresets(sample(), [reese, stab]), 'bass/reese');
    const changed = syncPresets(library, [{ ...reese, name: 'Reese 2', patch: pad }]);
    expect(changed.sounds.map((s) => s.id)).toEqual(['a', 'b', 'bass/reese']);
    expect(sound(changed, 'bass/reese')).toMatchObject({ name: 'Reese 2', favourite: true, patch: pad });
  });

  it('leaves presets out of library exports, since they come with the app', () => {
    const parsed = parseSoundFile(libraryToFile(syncPresets(sample(), [reese]), 0), 0);
    expect(parsed?.sounds.map((s) => s.id)).toEqual(['a', 'b']);
  });
});
