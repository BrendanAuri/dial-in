/** The master bus that voices connect to. */
import {
  LIMITER_ATTACK,
  LIMITER_KNEE_DB,
  LIMITER_RATIO,
  LIMITER_RELEASE,
  LIMITER_THRESHOLD_DB,
  MASTER_GAIN,
} from './constants';

export interface OutputOptions {
  /** Safety limiter for live playback. Leave off for offline renders used in scoring. */
  readonly limiter: boolean;
}

/** Create the fixed-gain master bus feeding `ctx.destination`. Returns its input. */
export function createOutputBus(ctx: BaseAudioContext, options: OutputOptions): GainNode {
  const master = new GainNode(ctx, { gain: MASTER_GAIN });
  if (options.limiter) {
    const limiter = new DynamicsCompressorNode(ctx, {
      threshold: LIMITER_THRESHOLD_DB,
      knee: LIMITER_KNEE_DB,
      ratio: LIMITER_RATIO,
      attack: LIMITER_ATTACK,
      release: LIMITER_RELEASE,
    });
    master.connect(limiter).connect(ctx.destination);
  } else {
    master.connect(ctx.destination);
  }
  return master;
}
