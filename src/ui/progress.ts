/** The app's one progress store, shared by every screen. */
import { useSyncExternalStore } from 'react';
import type { Progress } from '../game/progress';
import { createProgressStore, type ProgressStore } from '../game/progressStore';
import { browserStore } from '../storage/storage';

let instance: ProgressStore | null = null;

export function progressStore(): ProgressStore {
  instance ??= createProgressStore(browserStore());
  return instance;
}

export function useProgress(): Progress {
  const store = progressStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
