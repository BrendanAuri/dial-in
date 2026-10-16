/**
 * Seeded white noise. The same seed is used for every voice so a target and
 * an attempt with the same noise level render identically.
 */
import { NOISE_BUFFER_SECONDS, NOISE_SEED } from './constants';

/** Fill `out` with uniform white noise in [-1, 1) from a mulberry32 generator. */
export function fillWhiteNoise(out: Float32Array, seed: number): void {
  let state = seed >>> 0;
  for (let i = 0; i < out.length; i++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    const unit = ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    out[i] = unit * 2 - 1;
  }
}

const buffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** A looping noise buffer for `ctx`, created once per context. */
export function getNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = buffers.get(ctx);
  if (cached) return cached;
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * NOISE_BUFFER_SECONDS), ctx.sampleRate);
  fillWhiteNoise(buffer.getChannelData(0), NOISE_SEED);
  buffers.set(ctx, buffer);
  return buffer;
}
