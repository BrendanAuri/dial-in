/** Saving and naming files in the browser. */

/** Offer `text` to the user as a file download. */
export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "Big Reese #2" → "big-reese-2". */
export function fileSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'sound' : slug;
}

/** 2026-10-17, for file names. */
export function dateStamp(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
