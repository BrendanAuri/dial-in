/**
 * Offline rendering for audio scoring: the same voice code as live
 * playback, rendered to a buffer as fast as the machine allows.
 */
import { DECLICK_TIME, RENDER_SAMPLE_RATE, RENDER_TAIL } from './constants';
import { createOutputBus } from './output';
import type { Patch } from './params';
import { buildVoice } from './voice';

/** Seconds needed to render `patch` held for `holdTime`, including release and tail. */
export function renderDuration(patch: Readonly<Patch>, holdTime: number): number {
  return holdTime + patch['amp.release'] + DECLICK_TIME + RENDER_TAIL;
}

/**
 * Render one note of `patch`, held for `holdTime` seconds, to a mono buffer
 * `duration` seconds long (defaults to just long enough for the release).
 */
export async function renderPatch(
  patch: Readonly<Patch>,
  note: number,
  holdTime: number,
  duration: number = renderDuration(patch, holdTime),
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(duration * RENDER_SAMPLE_RATE), RENDER_SAMPLE_RATE);
  const voice = buildVoice(ctx, patch, note, 0, createOutputBus(ctx, { limiter: false }));
  voice.release(holdTime);
  return ctx.startRendering();
}

/** Render two patches with the same note, hold and length, ready for comparison. */
export async function renderPair(
  a: Readonly<Patch>,
  b: Readonly<Patch>,
  note: number,
  holdTime: number,
): Promise<[Float32Array, Float32Array]> {
  const duration = Math.max(renderDuration(a, holdTime), renderDuration(b, holdTime));
  const [bufferA, bufferB] = await Promise.all([
    renderPatch(a, note, holdTime, duration),
    renderPatch(b, note, holdTime, duration),
  ]);
  return [bufferA.getChannelData(0), bufferB.getChannelData(0)];
}
