import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYBOARD_OCTAVE } from '../engine/constants';
import { DEFAULT_PATCH } from '../engine/patch';
import { memoryStore } from '../storage/storage';
import type { Patch } from '../engine/params';
import { loadSession, openInFreePlay, saveSession, SESSION_KEY, unsavedSessionName, type FreePlaySession } from './session';

const session: FreePlaySession = {
  patch: { ...DEFAULT_PATCH, 'filter.cutoff': 500 },
  soundId: 'abc',
  soundName: 'Work in progress',
  baseline: { ...DEFAULT_PATCH },
  mode: 'mono',
  octave: 2,
};

describe('Free Play session', () => {
  it('round-trips', () => {
    const store = memoryStore();
    saveSession(store, session);
    expect(loadSession(store)).toEqual(session);
  });

  it('returns null when missing or unreadable', () => {
    expect(loadSession(memoryStore())).toBeNull();
    expect(loadSession(memoryStore({ [SESSION_KEY]: 'nope' }))).toBeNull();
    expect(loadSession(memoryStore({ [SESSION_KEY]: '{"schemaVersion":1}' }))).toBeNull();
  });

  it('repairs bad fields', () => {
    const store = memoryStore();
    saveSession(store, session);
    const data = JSON.parse(store.read(SESSION_KEY) ?? '{}') as Record<string, unknown>;
    store.write(SESSION_KEY, JSON.stringify({ ...data, octave: 99, mode: 'stereo', soundId: 7, baseline: null }));
    const loaded = loadSession(store);
    expect(loaded?.octave).toBe(6);
    expect(loaded?.mode).toBe('poly');
    expect(loaded?.soundId).toBeNull();
    expect(loaded?.baseline).toEqual(session.patch);
    store.write(SESSION_KEY, JSON.stringify({ ...data, octave: 'high' }));
    expect(loadSession(store)?.octave).toBe(DEFAULT_KEYBOARD_OCTAVE);
  });
});

describe('opening a sound in Free Play', () => {
  const shared: Patch = { ...DEFAULT_PATCH, 'filter.cutoff': 700 };

  it('makes it the working sound, unsaved unless it has a library id', () => {
    const store = memoryStore();
    saveSession(store, { patch: DEFAULT_PATCH, soundId: null, soundName: 'Old', baseline: DEFAULT_PATCH, mode: 'mono', octave: 2 });
    expect(unsavedSessionName(store)).toBeNull();
    openInFreePlay(store, { name: 'Shared', patch: shared, id: null });
    expect(loadSession(store)).toMatchObject({ patch: shared, soundId: null, soundName: 'Shared', mode: 'mono', octave: 2 });
    expect(unsavedSessionName(store)).toBe('Shared');
    openInFreePlay(store, { name: 'Kept', patch: shared, id: 'abc' });
    expect(unsavedSessionName(store)).toBeNull();
  });
});
