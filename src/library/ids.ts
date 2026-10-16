/** Random ids for saved sounds. */

/**
 * A random UUID. crypto.randomUUID only exists on secure origins, so this
 * falls back to getRandomValues (e.g. when testing on a phone over plain
 * http on the local network).
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
