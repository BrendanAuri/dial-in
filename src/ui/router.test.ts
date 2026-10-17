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
];

describe('router', () => {
  it('round-trips every route', () => {
    for (const route of ROUTES) expect(parseRoute(routeHash(route))).toEqual(route);
  });

  it('falls back to home for anything unknown or incomplete', () => {
    for (const hash of ['', '#', '#/', '#/nope', '#/pack', '#/play/foundations']) expect(parseRoute(hash)).toEqual({ name: 'home' });
  });
});
