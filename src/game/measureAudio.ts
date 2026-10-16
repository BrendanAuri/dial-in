/** Render target and attempt offline and compare how they sound. */
import { RENDER_SAMPLE_RATE } from '../engine/constants';
import type { Patch } from '../engine/params';
import { renderPair } from '../engine/render';
import { audioScore, type AudioScore } from '../scoring/audioScore';

/** The audio score for an attempt, or null if rendering isn't possible here. */
export async function measureAudio(
  target: Readonly<Patch>,
  mine: Readonly<Patch>,
  note: number,
  holdTime: number,
): Promise<AudioScore | null> {
  try {
    const [targetSamples, mineSamples] = await renderPair(target, mine, note, holdTime);
    return audioScore(targetSamples, mineSamples, RENDER_SAMPLE_RATE);
  } catch {
    return null;
  }
}
