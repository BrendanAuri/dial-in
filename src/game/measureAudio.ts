/** Render target and attempt offline, compare how they sound, and take their spectra for display. */
import { RENDER_SAMPLE_RATE } from '../engine/constants';
import type { Patch } from '../engine/params';
import { renderPair } from '../engine/render';
import { audioScore, type AudioScore } from '../scoring/audioScore';
import { bandSpectrum, type BandSpectrum } from '../scoring/spectrum';

export interface PairSpectra {
  readonly target: BandSpectrum;
  readonly mine: BandSpectrum;
}

export interface AudioMeasurement {
  readonly score: AudioScore;
  readonly spectra: PairSpectra;
}

/** The audio score and spectra for an attempt, or null if rendering isn't possible here. */
export async function measureAudio(
  target: Readonly<Patch>,
  mine: Readonly<Patch>,
  note: number,
  holdTime: number,
): Promise<AudioMeasurement | null> {
  try {
    const [targetSamples, mineSamples] = await renderPair(target, mine, note, holdTime);
    return {
      score: audioScore(targetSamples, mineSamples, RENDER_SAMPLE_RATE),
      spectra: {
        target: bandSpectrum(targetSamples, RENDER_SAMPLE_RATE),
        mine: bandSpectrum(mineSamples, RENDER_SAMPLE_RATE),
      },
    };
  } catch {
    return null;
  }
}
