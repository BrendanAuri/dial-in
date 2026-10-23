/**
 * Share codes: a sound, or a challenge made from one, as a short URL-safe
 * string, so it can be sent as a link with no backend.
 *
 * Bytes, then base64url, then a check value:
 *   version · kind (0 sound, 1 challenge)
 *   control count N · mask of the controls that differ from the defaults
 *   (⌈N/8⌉ bytes) · two bytes per control in the mask
 *   challenge only: mask of the solver's controls (⌈N/8⌉ bytes) · note (MIDI)
 *   name length · name (UTF-8)
 *
 * Controls are numbered by SHARE_ORDER, which only ever grows at the end,
 * and every value takes two bytes, so an older version of the app can skip
 * controls it doesn't know. Continuous values are their knob position in
 * SHARE_VALUE_STEPS steps; choices are their option index.
 */
import { SHARE_CHECK_CHARS, SHARE_CODE_VERSION, SHARE_VALUE_STEPS } from '../engine/constants';
import { PARAMS, PARAM_IDS, type ParamId, type Patch } from '../engine/params';
import { DEFAULT_PATCH, patchFromRecord } from '../engine/patch';
import { fromNormalised, toNormalised } from '../engine/scale';
import { cleanName } from '../library/library';
import { hashString } from './rng';

const BITS_PER_BYTE = 8;
const BYTE_MAX = 0xff;
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const BITS_PER_CHAR = 6;
/** base64 text comes in groups of this many characters, padded with '='. */
const BASE64_GROUP = 4;
const CHAR_MASK = 0b111111;
const KIND_SOUND = 0;
const KIND_CHALLENGE = 1;
const MIDI_MAX = 127;

/**
 * Every control, numbered for share codes. Only ever add to the end:
 * links already sent depend on these positions.
 */
export const SHARE_ORDER: readonly ParamId[] = [
  'osc.wave',
  'osc.octave',
  'osc2.detune',
  'noise.level',
  'filter.cutoff',
  'filter.resonance',
  'fenv.amount',
  'fenv.decay',
  'amp.attack',
  'amp.decay',
  'amp.sustain',
  'amp.release',
  'lfo.target',
  'lfo.rate',
  'lfo.depth',
  'sub.level',
  'drive.amount',
  'lfo.sync',
  'lfo.tempo',
];

export interface SharedSound {
  readonly kind: 'sound';
  readonly name: string;
  readonly patch: Patch;
}

/** A sound to match, with the controls the solver gets and the note it plays on. */
export interface Challenge {
  readonly kind: 'challenge';
  readonly name: string;
  readonly patch: Patch;
  readonly controls: readonly ParamId[];
  readonly note: number;
}

export type Shared = SharedSound | Challenge;

export type DecodeResult =
  | { readonly ok: true; readonly shared: Shared }
  /** 'newer': made by a newer version of the app. 'broken': cut short, mistyped or not a code. */
  | { readonly ok: false; readonly reason: 'newer' | 'broken' };

// ── Values ───────────────────────────────────────────────────────────────

function valueToStep(id: ParamId, patch: Readonly<Patch>): number {
  const def = PARAMS[id];
  if (def.kind === 'continuous') return Math.round(toNormalised(def, patch[def.id]) * SHARE_VALUE_STEPS);
  const value: unknown = patch[def.id];
  return Math.max(0, def.options.findIndex((option) => option.value === value));
}

function stepToValue(id: ParamId, step: number): unknown {
  const def = PARAMS[id];
  if (def.kind === 'continuous') return fromNormalised(def, step / SHARE_VALUE_STEPS);
  return def.options[step]?.value;
}

// ── Bytes ────────────────────────────────────────────────────────────────

function maskSize(count: number): number {
  return Math.ceil(count / BITS_PER_BYTE);
}

function writeMask(out: number[], included: (index: number) => boolean): void {
  for (let byte = 0; byte < maskSize(SHARE_ORDER.length); byte++) {
    let bits = 0;
    for (let bit = 0; bit < BITS_PER_BYTE; bit++) {
      if (included(byte * BITS_PER_BYTE + bit)) bits |= 1 << bit;
    }
    out.push(bits);
  }
}

class BrokenCode extends Error {}

class Reader {
  private position = 0;
  constructor(private readonly bytes: Uint8Array) {}

  byte(): number {
    const value = this.bytes[this.position++];
    if (value === undefined) throw new BrokenCode();
    return value;
  }

  uint16(): number {
    return (this.byte() << BITS_PER_BYTE) | this.byte();
  }

  mask(count: number): boolean[] {
    const flags: boolean[] = [];
    for (let byte = 0; byte < maskSize(count); byte++) {
      const bits = this.byte();
      for (let bit = 0; bit < BITS_PER_BYTE; bit++) flags.push((bits & (1 << bit)) !== 0);
    }
    return flags.slice(0, count);
  }

  take(length: number): Uint8Array {
    if (this.position + length > this.bytes.length) throw new BrokenCode();
    const slice = this.bytes.subarray(this.position, this.position + length);
    this.position += length;
    return slice;
  }

  get done(): boolean {
    return this.position === this.bytes.length;
  }
}

// ── Text ─────────────────────────────────────────────────────────────────

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / BASE64_GROUP) * BASE64_GROUP, '=')), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** A short check value for the code's text, in base64url characters. */
function checkFor(payload: string): string {
  const hash = hashString(payload);
  let check = '';
  for (let i = SHARE_CHECK_CHARS - 1; i >= 0; i--) check += BASE64URL[(hash >>> (i * BITS_PER_CHAR)) & CHAR_MASK] ?? '';
  return check;
}

/** The name as UTF-8, shortened if needed so its length fits in a byte. */
function nameBytes(name: string): Uint8Array {
  const encoder = new TextEncoder();
  let text = cleanName(name);
  let bytes = encoder.encode(text);
  while (bytes.length > BYTE_MAX) {
    text = text.slice(0, -1);
    bytes = encoder.encode(text);
  }
  return bytes;
}

// ── Encoding and decoding ────────────────────────────────────────────────

/** Bytes to a finished code, with its check value. Exposed for tests. */
export function bytesToCode(bytes: readonly number[]): string {
  const payload = toBase64Url(Uint8Array.from(bytes));
  return payload + checkFor(payload);
}

export function encodeShareCode(shared: Shared): string {
  const changed = SHARE_ORDER.map((id) => shared.patch[id] !== DEFAULT_PATCH[id]);
  const out: number[] = [SHARE_CODE_VERSION, shared.kind === 'sound' ? KIND_SOUND : KIND_CHALLENGE, SHARE_ORDER.length];
  writeMask(out, (i) => changed[i] === true);
  SHARE_ORDER.forEach((id, i) => {
    if (!changed[i]) return;
    const step = valueToStep(id, shared.patch);
    out.push(step >>> BITS_PER_BYTE, step & BYTE_MAX);
  });
  if (shared.kind === 'challenge') {
    const controls = new Set(shared.controls);
    writeMask(out, (i) => {
      const id = SHARE_ORDER[i];
      return id !== undefined && controls.has(id);
    });
    out.push(Math.min(MIDI_MAX, Math.max(0, Math.round(shared.note))));
  }
  const name = nameBytes(shared.name);
  out.push(name.length, ...name);
  return bytesToCode(out);
}

export function decodeShareCode(code: string): DecodeResult {
  const text = code.trim();
  const payload = text.slice(0, -SHARE_CHECK_CHARS);
  if (payload === '' || checkFor(payload) !== text.slice(-SHARE_CHECK_CHARS)) return { ok: false, reason: 'broken' };
  const bytes = fromBase64Url(payload);
  if (!bytes) return { ok: false, reason: 'broken' };
  try {
    const reader = new Reader(bytes);
    const version = reader.byte();
    if (version > SHARE_CODE_VERSION) return { ok: false, reason: 'newer' };
    if (version < 1) return { ok: false, reason: 'broken' };
    const kind = reader.byte();
    if (kind !== KIND_SOUND && kind !== KIND_CHALLENGE) return { ok: false, reason: 'newer' };
    const count = reader.byte();
    const record: Record<string, unknown> = {};
    // Controls this version doesn't know still take two bytes each, so they're read and skipped.
    reader.mask(count).forEach((set, i) => {
      if (!set) return;
      const step = reader.uint16();
      const id = SHARE_ORDER[i];
      if (id) record[id] = stepToValue(id, step);
    });
    const patch = patchFromRecord(record);
    let controls: ParamId[] = [];
    let note = 0;
    if (kind === KIND_CHALLENGE) {
      const flags = reader.mask(count);
      controls = PARAM_IDS.filter((id) => flags[SHARE_ORDER.indexOf(id)] === true);
      note = reader.byte();
    }
    const name = cleanName(new TextDecoder().decode(reader.take(reader.byte())));
    if (!reader.done) return { ok: false, reason: 'broken' };
    const shared: Shared = kind === KIND_SOUND ? { kind: 'sound', name, patch } : { kind: 'challenge', name, patch, controls, note };
    return { ok: true, shared };
  } catch (error) {
    if (error instanceof BrokenCode) return { ok: false, reason: 'broken' };
    throw error;
  }
}
