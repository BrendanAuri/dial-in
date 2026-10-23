import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, type Route } from './router';

const ROUTES: readonly Route[] = [
  { name: 'home' },
  { name: 'pack', packId: 'foundations' },
  { name: 'level', packId: 'bass.dubstep', levelId: 'wobble-2' },
  { name: 'practice' },
  { name: 'practice', packId: 'foundations', levelId: 'brightness' },
  { name: 'daily' },
  { name: 'daily', date: '2026-10-15' },
  { name: 'freeplay' },
  { name: 'calibrate' },
  { name: 'shared', kind: 'sound', code: 'AQAT-x_9' },
  { name: 'shared', kind: 'challenge', code: 'AQET-x_9' },
];

describe('router', () => {
  it('round-trips every route', () => {
    for (const route of ROUTES) expect(parseRoute(routeHash(route))).toEqual(route);
  });

  it('falls back to home for anything unknown or incomplete', () => {
    for (const hash of ['', '#', '#/', '#/nope', '#/pack', '#/play/foundations', '#/p', '#/c/']) {
      expect(parseRoute(hash)).toEqual({ name: 'home' });
    }
  });

  it('opens shared sounds at #/p/ and challenges at #/c/', () => {
    expect(routeHash({ name: 'shared', kind: 'sound', code: 'abc' })).toBe('#/p/abc');
    expect(parseRoute('#/c/abc')).toEqual({ name: 'shared', kind: 'challenge', code: 'abc' });
  });
});
