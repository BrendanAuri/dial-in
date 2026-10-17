/**
 * Installing as an app: the browser's install prompt where there is one
 * (Chrome, Edge, Android), and detection for iOS, where installing is done
 * by hand from the Share menu. Installed apps keep their storage, so
 * progress and saved sounds are safer.
 */
import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function isInstallPrompt(event: Event): event is InstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function';
}

/** Call once at startup: the browser fires its install event early. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isInstallPrompt(event)) return;
    event.preventDefault();
    deferred = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True once the browser has offered to install the app. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferred !== null);
}

/** Show the browser's install dialog. */
export async function install(): Promise<void> {
  const event = deferred;
  deferred = null;
  notify();
  await event?.prompt();
}

/** Running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  const nav: Navigator & { standalone?: boolean } = navigator;
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/** iPhone or iPad (iPadOS reports itself as a Mac with touch). */
export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}
