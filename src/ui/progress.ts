/** The app's one progress store, shared by every screen. */
import { useSyncExternalStore } from 'react';
import type { Progress } from '../game/progress';
import { createProgressStore, type ProgressStore } from '../game/progressStore';
import { browserStore, requestPersistentStorage } from '../storage/storage';

let instance: ProgressStore | null = null;

export function progressStore(): ProgressStore {
  if (!instance) {
    const store = createProgressStore(browserStore());
    // Once there's progress worth keeping, ask the browser not to clear it.
    const unsubscribe = store.subscribe(() => {
      unsubscribe();
      void requestPersistentStorage();
    });
    instance = store;
  }
  return instance;
}

export function useProgress(): Progress {
  const store = progressStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
