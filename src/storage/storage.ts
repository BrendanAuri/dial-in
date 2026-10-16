/**
 * Key-value storage behind a small interface, so callers don't touch
 * localStorage directly and it can be swapped for IndexedDB later.
 */

export interface KeyValueStore {
  read(key: string): string | null;
  /** Returns false if the write failed (storage full, blocked or unavailable). */
  write(key: string, value: string): boolean;
  remove(key: string): void;
}

export function memoryStore(initial: Readonly<Record<string, string>> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    read: (key) => data.get(key) ?? null,
    write: (key, value) => {
      data.set(key, value);
      return true;
    },
    remove: (key) => {
      data.delete(key);
    },
  };
}

/** localStorage, or an in-memory store if the browser blocks it. */
export function browserStore(): KeyValueStore {
  let storage: Storage;
  try {
    storage = window.localStorage;
    storage.getItem('');
  } catch {
    return memoryStore();
  }
  return {
    read: (key) => {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    write: (key, value) => {
      try {
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove: (key) => {
      try {
        storage.removeItem(key);
      } catch {
        // Nothing useful to do if removal fails.
      }
    },
  };
}

/**
 * Ask the browser not to clear our data under storage pressure or after a
 * period of disuse. Resolves to whether storage is persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
