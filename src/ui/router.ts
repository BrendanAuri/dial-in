/**
 * Hash routes, so the browser's back button and reloads keep you where you
 * were: #/, #/pack/foundations, #/play/foundations/brightness, #/practice,
 * #/practice/foundations/brightness, #/daily, #/daily/2026-10-15, #/free-play,
 * and #calibrate (dev page).
 */
import { useCallback, useSyncExternalStore } from 'react';

export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'pack'; readonly packId: string }
  | { readonly name: 'level'; readonly packId: string; readonly levelId: string }
  | { readonly name: 'practice'; readonly packId?: string; readonly levelId?: string }
  | { readonly name: 'daily'; readonly date?: string }
  | { readonly name: 'freeplay' }
  | { readonly name: 'calibrate' };

export const CALIBRATION_HASH = '#calibrate';

export function parseRoute(hash: string): Route {
  if (hash === CALIBRATION_HASH) return { name: 'calibrate' };
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [first, second, third] = parts;
  if (first === 'pack' && second) return { name: 'pack', packId: second };
  if (first === 'play' && second && third) return { name: 'level', packId: second, levelId: third };
  if (first === 'practice') return second && third ? { name: 'practice', packId: second, levelId: third } : { name: 'practice' };
  if (first === 'daily') return second ? { name: 'daily', date: second } : { name: 'daily' };
  if (first === 'free-play') return { name: 'freeplay' };
  return { name: 'home' };
}

export function routeHash(route: Route): string {
  const e = encodeURIComponent;
  switch (route.name) {
    case 'home':
      return '#/';
    case 'pack':
      return `#/pack/${e(route.packId)}`;
    case 'level':
      return `#/play/${e(route.packId)}/${e(route.levelId)}`;
    case 'practice':
      return route.packId && route.levelId ? `#/practice/${e(route.packId)}/${e(route.levelId)}` : '#/practice';
    case 'daily':
      return route.date ? `#/daily/${e(route.date)}` : '#/daily';
    case 'freeplay':
      return '#/free-play';
    case 'calibrate':
      return CALIBRATION_HASH;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export type Navigate = (route: Route, options?: { readonly replace?: boolean }) => void;

/** The current route, and a function to go to another (adding a history entry unless `replace`). */
export function useRoute(): [Route, Navigate] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const navigate = useCallback<Navigate>((route, options) => {
    const next = routeHash(route);
    if (options?.replace) window.location.replace(next);
    else window.location.hash = next;
  }, []);
  return [parseRoute(hash), navigate];
}
