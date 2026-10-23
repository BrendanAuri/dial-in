import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH } from '../engine/patch';
import { memoryStore } from '../storage/storage';
import { addSound, EMPTY_LIBRARY } from './library';
import { keepSound, LIBRARY_KEY, loadLibrary, saveLibrary } from './libraryStore';

describe('library storage', () => {
  it('starts empty when nothing is stored', () => {
    expect(loadLibrary(memoryStore(), 0)).toEqual({ library: EMPTY_LIBRARY });
  });

  it('saves and loads a library', () => {
    const store = memoryStore();
    const library = addSound(EMPTY_LIBRARY, { name: 'Pluck', tags: ['keys'], patch: DEFAULT_PATCH }, { id: 'a', now: 5 });
    expect(saveLibrary(store, library)).toBe(true);
    expect(loadLibrary(store, 0).library).toEqual(library);
    expect(JSON.parse(store.read(LIBRARY_KEY) ?? '{}')).toMatchObject({ schemaVersion: 1 });
  });

  it('keeps a copy of unreadable data instead of losing it', () => {
    const store = memoryStore({ [LIBRARY_KEY]: '{broken' });
    const loaded = loadLibrary(store, 123);
    expect(loaded.library).toEqual(EMPTY_LIBRARY);
    expect(loaded.rescueKey).toBeDefined();
    expect(store.read(loaded.rescueKey ?? '')).toBe('{broken');
  });

  it('drops individual bad sounds but keeps the rest', () => {
    const good = addSound(EMPTY_LIBRARY, { name: 'Good', tags: [], patch: DEFAULT_PATCH }, { id: 'g', now: 1 });
    const store = memoryStore();
    saveLibrary(store, good);
    const stored = JSON.parse(store.read(LIBRARY_KEY) ?? '{}') as { sounds: unknown[] };
    store.write(LIBRARY_KEY, JSON.stringify({ ...stored, sounds: [...stored.sounds, { id: 'bad' }] }));
    expect(loadLibrary(store, 0).library.sounds.map((s) => s.id)).toEqual(['g']);
  });

  it('reports a failed write', () => {
    const full = { read: () => null, write: () => false, remove: () => undefined };
    expect(saveLibrary(full, EMPTY_LIBRARY)).toBe(false);
  });
});

describe('keepSound', () => {
  const draft = { name: 'Pad', tags: ['matched'], patch: { ...DEFAULT_PATCH, 'amp.attack': 0.8 } };

  it('adds the sound to the stored library once', () => {
    const store = memoryStore();
    expect(keepSound(store, draft, { id: 'k1', now: 10 })).toBe('kept');
    expect(keepSound(store, draft, { id: 'k2', now: 20 })).toBe('already');
    expect(loadLibrary(store, 0).library.sounds.map((s) => [s.id, s.name, s.source])).toEqual([['k1', 'Pad', 'user']]);
  });

  it("won't write over a library it can't read", () => {
    const store = memoryStore({ [LIBRARY_KEY]: 'not json' });
    expect(keepSound(store, draft, { id: 'k1', now: 10 })).toBe('failed');
    expect(store.read(LIBRARY_KEY)).toBe('not json');
  });
});
