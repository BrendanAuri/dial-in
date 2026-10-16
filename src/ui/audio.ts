/** Live audio setup. Must be started from a user gesture (mobile browsers require it). */
import { createOutputBus } from '../engine/output';

export interface LiveAudio {
  readonly ctx: AudioContext;
  /** Master bus input that live voices connect to. */
  readonly output: AudioNode;
}

interface AudioSessionNavigator {
  audioSession?: { type: string };
}

// One context for the app's lifetime. Reused if a first tap's resume() is still pending.
let context: AudioContext | null = null;
let live: LiveAudio | null = null;

/** Create (once) and resume the AudioContext. Call directly from a tap or click handler. */
export async function startAudio(): Promise<LiveAudio> {
  // On iOS Safari, a "playback" audio session keeps sound on when the silent switch is set.
  const nav: Navigator & AudioSessionNavigator = navigator;
  if (nav.audioSession) nav.audioSession.type = 'playback';

  context ??= new AudioContext({ latencyHint: 'interactive' });
  await context.resume();
  live ??= { ctx: context, output: createOutputBus(context, { limiter: true }) };
  return live;
}
