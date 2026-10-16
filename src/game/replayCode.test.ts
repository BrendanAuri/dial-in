import { describe, expect, it } from 'vitest';
import { formatReplayCode, parseReplayCode } from './replayCode';

describe('replay codes', () => {
  it('round-trips', () => {
    const code = { packId: 'bass.dubstep', levelId: 'wobble-2', packVersion: 4, seed: 0xdeadbeef };
    const text = formatReplayCode(code);
    expect(text).toBe('bass.dubstep/wobble-2@4:1ps9wxb');
    expect(parseReplayCode(text)).toEqual(code);
  });

  it('accepts surrounding spaces and capitals', () => {
    expect(parseReplayCode('  DEV/Brightness@1:ABC  ')).toEqual({ packId: 'dev', levelId: 'brightness', packVersion: 1, seed: parseInt('abc', 36) });
  });

  it('rejects malformed codes', () => {
    for (const bad of ['', 'dev/brightness', 'dev/brightness@1', 'dev@1:abc', '/x@1:a', 'dev/x@v1:abc', 'dev/x@1:zzzzzzzz']) {
      expect(parseReplayCode(bad), bad).toBeNull();
    }
  });
});
