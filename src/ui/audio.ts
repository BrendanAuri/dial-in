/** Live audio setup. Must be started from a user gesture (mobile browsers require it). */
import {
  ANALYSER_FFT_SIZE,
  ANALYSER_MAX_DB,
  ANALYSER_MIN_DB,
  ANALYSER_SMOOTHING,
} from '../engine/constants';
import { createOutputBus } from '../engine/output';

export interface LiveAudio {
  readonly ctx: AudioContext;
  /** Master bus input that live voices connect to. */
  readonly output: AudioNode;
  /** Taps the master bus for the live spectrum view. */
  readonly analyser: AnalyserNode;
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
  if (!live) {
    const output = createOutputBus(context, { limiter: true });
    const analyser = new AnalyserNode(context, {
      fftSize: ANALYSER_FFT_SIZE,
      smoothingTimeConstant: ANALYSER_SMOOTHING,
      minDecibels: ANALYSER_MIN_DB,
      maxDecibels: ANALYSER_MAX_DB,
    });
    output.connect(analyser);
    live = { ctx: context, output, analyser };
  }
  return live;
}
