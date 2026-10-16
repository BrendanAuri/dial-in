import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query currently matches, updating when it changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** True when keystrokes should go to the focused element rather than to shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'file', 'submit', 'reset'].includes(target.type);
  }
  return false;
}

/** True for elements that Space activates on their own. */
export function isButtonLike(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, [role="button"], a[href]') !== null;
}
