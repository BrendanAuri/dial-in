import { describe, expect, it } from 'vitest';
import { SHARE_CODE_VERSION } from '../engine/constants';
import { PARAMS, PARAM_IDS, type Patch } from '../engine/params';
import { DEFAULT_PATCH } from '../engine/patch';
import { toNormalised } from '../engine/scale';
import { bytesToCode, decodeShareCode, encodeShareCode, SHARE_ORDER, type Shared } from './shareCode';

const growl: Patch = {
  ...DEFAULT_PATCH,
  'osc.wave': 'square',
  'osc.octave': -1,
  'osc2.detune': 10,
  'filter.cutoff': 250,
  'filter.resonance': 0.7,
  'drive.amount': 0.85,
  'lfo.target': 'cutoff',
  'lfo.sync': '1/8T',
  'lfo.tempo': 140,
  'lfo.depth': 0.5,
};

function decoded(code: string): Shared {
  const result = decodeShareCode(code);
  if (!result.ok) throw new Error(`didn't decode: ${result.reason}`);
  return result.shared;
}

/** Same sound: choices exact, continuous values within one 16-bit step of the knob. */
function expectSameSound(a: Patch, b: Patch): void {
  for (const id of PARAM_IDS) {
    const def = PARAMS[id];
    if (def.kind === 'continuous') expect(toNormalised(def, a[def.id]), id).toBeCloseTo(toNormalised(def, b[def.id]), 4);
    else expect(a[id], id).toBe(b[id]);
  }
}

describe('share codes', () => {
  it('numbers every control exactly once', () => {
    expect([...SHARE_ORDER].sort()).toEqual([...PARAM_IDS].sort());
  });

  it('round-trips a sound, its name included', () => {
    const shared = decoded(encodeShareCode({ kind: 'sound', name: 'Triplet growl ✦', patch: growl }));
    expect(shared.kind).toBe('sound');
    expect(shared.name).toBe('Triplet growl ✦');
    expectSameSound(shared.patch, growl);
    expect(shared.patch['lfo.tempo']).toBe(140);
  });

  it('keeps default values exact and the default sound short', () => {
    const code = encodeShareCode({ kind: 'sound', name: '', patch: DEFAULT_PATCH });
    expect(decoded(code).patch).toEqual(DEFAULT_PATCH);
    // An empty name is stored as "Untitled", the same as everywhere else.
    expect(code.length).toBeLessThan(25);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('round-trips a challenge with its controls and note', () => {
    const shared = decoded(
      encodeShareCode({ kind: 'challenge', name: 'Growl', patch: growl, controls: ['drive.amount', 'lfo.sync'], note: 36 }),
    );
    expect(shared).toMatchObject({ kind: 'challenge', name: 'Growl', controls: ['drive.amount', 'lfo.sync'], note: 36 });
  });

  it('reads codes made before today exactly the same way', () => {
    // Pinned so a change to the format can't quietly break links already sent.
    const code = encodeShareCode({ kind: 'sound', name: 'Pinned', patch: growl });
    expect(code).toBe(PINNED_GROWL);
    expectSameSound(decoded(PINNED_GROWL).patch, growl);
  });

  it('rejects codes that are cut short, mistyped or not codes at all', () => {
    const code = encodeShareCode({ kind: 'sound', name: 'Reese', patch: growl });
    expect(decodeShareCode(code.slice(0, -3))).toEqual({ ok: false, reason: 'broken' });
    const flipped = code.slice(0, 5) + (code[5] === 'A' ? 'B' : 'A') + code.slice(6);
    expect(decodeShareCode(flipped)).toEqual({ ok: false, reason: 'broken' });
    expect(decodeShareCode('hello world')).toEqual({ ok: false, reason: 'broken' });
    expect(decodeShareCode('')).toEqual({ ok: false, reason: 'broken' });
  });

  it('says when a code comes from a newer version', () => {
    expect(decodeShareCode(bytesToCode([SHARE_CODE_VERSION + 1, 0, 0, 0]))).toEqual({ ok: false, reason: 'newer' });
  });

  it('skips controls added by a newer version', () => {
    // 20 controls: the 19 known ones, none changed, plus one unknown at index 19 set to 1234.
    const unknownBit = 1 << (19 % 8);
    const code = bytesToCode([SHARE_CODE_VERSION, 0, 20, 0, 0, unknownBit, 0x04, 0xd2, 0]);
    expect(decoded(code)).toEqual({ kind: 'sound', name: 'Untitled', patch: DEFAULT_PATCH });
  });
});

/** encodeShareCode of the growl named "Pinned", recorded 2026-10-23. */
const PINNED_GROWL = 'AQATN1AHAAMAADMzTMqzMwABgADZmQAFkkkGUGlubmVkxd';
