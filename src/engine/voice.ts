/**
 * One synth voice: a single note through the signal chain.
 *
 *   osc 1 ─┐
 *   osc 2 ─┼─> lowpass ─> drive ─┐
 *   noise ─┘     ^               ├─> amp env ─> tremolo ─> out (declick × voice gain) ─> destination
 *                │        sub ───┘
 *          filter env + LFO (both on filter.detune, so they move in octaves)
 *
 * The sub (a sine below osc 1) joins after the filter and drive, so it
 * stays clean however the rest is shaped.
 *
 * The same code runs in a live AudioContext and in an OfflineAudioContext.
 */
import {
  DECLICK_TIME,
  DRIVE_HEADROOM,
  DRIVE_OVERSAMPLE,
  NOISE_MAX_GAIN,
  OSC_MIX_GAIN,
  PARAM_SMOOTHING_TIME,
  RESONANCE_MAX_DB,
  SEMITONES_PER_OCTAVE,
  SUB_MAX_GAIN,
  SUB_OCTAVES_BELOW,
  VOICE_GAIN,
} from './constants';
import { driveCurve } from './drive';
import {
  ampEnvelopeValue,
  filterEnvPeakOctaves,
  lfoModulationAmount,
  lfoRateHz,
  octavesToCents,
  segmentTimeConstant,
  tremoloBaseGain,
  type AmpEnvelope,
} from './modulation';
import { getNoiseBuffer } from './noise';
import { midiToHz } from './notes';
import { PARAMS, type LfoTarget, type ParamId, type Patch, type Waveform } from './params';

export interface VoiceHandle {
  readonly note: number;
  readonly startTime: number;
  /** When the voice will have faded out and stopped; Infinity while held. */
  readonly endTime: number;
  /** Resolves once the voice has stopped and released its nodes. */
  readonly ended: Promise<void>;
  /** Start the release stage at `time`. Returns the end time. Later calls do nothing. */
  release(time: number): number;
  /** Fade out quickly from `time`, skipping the release stage. Returns the end time. */
  stop(time: number): number;
  /**
   * Apply changed settings to the sounding voice from `time`. Attack, decay,
   * sustain and the filter envelope apply from the next note; release
   * applies to this note's release if it hasn't started yet.
   */
  update(patch: Readonly<Patch>, time: number): void;
}

const OSC_TYPES: Readonly<Record<Waveform, OscillatorType>> = {
  sine: 'sine',
  triangle: 'triangle',
  saw: 'sawtooth',
  square: 'square',
};

const MAX_CUTOFF = PARAMS['filter.cutoff'].max;

function oscFrequency(note: number, patch: Readonly<Patch>): number {
  return midiToHz(note + patch['osc.octave'] * SEMITONES_PER_OCTAVE);
}

function subFrequency(note: number, patch: Readonly<Patch>): number {
  return oscFrequency(note, patch) / 2 ** SUB_OCTAVES_BELOW;
}

class Voice implements VoiceHandle {
  readonly note: number;
  readonly startTime: number;
  readonly ended: Promise<void>;

  private current: Patch;
  private readonly env: AmpEnvelope;
  private releaseSeconds: number;
  private end = Infinity;

  private readonly osc1: OscillatorNode;
  private readonly osc2: OscillatorNode;
  private readonly sub: OscillatorNode;
  private readonly noise: AudioBufferSourceNode;
  private readonly lfo: OscillatorNode;
  private readonly nodes: readonly AudioNode[];
  private readonly noiseGain: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly shaper: WaveShaperNode;
  private readonly subGain: GainNode;
  private readonly amp: GainNode;
  private readonly tremolo: GainNode;
  private readonly lfoGain: GainNode;
  private readonly out: GainNode;

  constructor(ctx: BaseAudioContext, patch: Readonly<Patch>, note: number, startTime: number, destination: AudioNode) {
    this.note = note;
    this.startTime = startTime;
    this.current = { ...patch };
    this.env = { attack: patch['amp.attack'], decay: patch['amp.decay'], sustain: patch['amp.sustain'] };
    this.releaseSeconds = patch['amp.release'];

    const type = OSC_TYPES[patch['osc.wave']];
    const frequency = oscFrequency(note, patch);
    // Detune is split either side of the note so the pitch stays centred.
    // At 0 cents both oscillators are identical and in phase: "osc 2 off".
    const halfDetune = patch['osc2.detune'] / 2;
    const lfoTarget = patch['lfo.target'];
    const lfoDepth = patch['lfo.depth'];

    this.osc1 = new OscillatorNode(ctx, { type, frequency, detune: -halfDetune });
    this.osc2 = new OscillatorNode(ctx, { type, frequency, detune: halfDetune });
    const oscMix = new GainNode(ctx, { gain: OSC_MIX_GAIN });
    this.sub = new OscillatorNode(ctx, { type: 'sine', frequency: subFrequency(note, patch) });
    this.subGain = new GainNode(ctx, { gain: patch['sub.level'] * SUB_MAX_GAIN });
    this.noise = new AudioBufferSourceNode(ctx, { buffer: getNoiseBuffer(ctx), loop: true });
    this.noiseGain = new GainNode(ctx, { gain: patch['noise.level'] * NOISE_MAX_GAIN });
    this.filter = new BiquadFilterNode(ctx, {
      type: 'lowpass',
      frequency: patch['filter.cutoff'],
      Q: patch['filter.resonance'] * RESONANCE_MAX_DB,
    });
    // Drive: scaled down into the shaper and back up, so its curve covers
    // loud resonant peaks too. With no drive the shaper has no curve and
    // passes the signal through untouched.
    const driveIn = new GainNode(ctx, { gain: 1 / DRIVE_HEADROOM });
    this.shaper = new WaveShaperNode(ctx, { oversample: DRIVE_OVERSAMPLE });
    this.shaper.curve = driveCurve(patch['drive.amount']);
    const driveOut = new GainNode(ctx, { gain: DRIVE_HEADROOM });
    this.amp = new GainNode(ctx, { gain: 0 });
    this.tremolo = new GainNode(ctx, { gain: tremoloBaseGain(lfoTarget, lfoDepth) });
    this.out = new GainNode(ctx, { gain: 0 });
    this.lfo = new OscillatorNode(ctx, { type: 'sine', frequency: lfoRateHz(patch) });
    this.lfoGain = new GainNode(ctx, { gain: lfoModulationAmount(lfoTarget, lfoDepth) });
    this.nodes = [
      this.osc1, this.osc2, oscMix, this.sub, this.subGain, this.noise, this.noiseGain, this.filter,
      driveIn, this.shaper, driveOut, this.amp, this.tremolo, this.out, this.lfo, this.lfoGain,
    ];

    this.osc1.connect(oscMix);
    this.osc2.connect(oscMix);
    oscMix.connect(this.filter);
    this.noise.connect(this.noiseGain).connect(this.filter);
    this.filter.connect(driveIn).connect(this.shaper).connect(driveOut).connect(this.amp);
    this.sub.connect(this.subGain).connect(this.amp);
    this.amp.connect(this.tremolo).connect(this.out).connect(destination);
    this.lfo.connect(this.lfoGain);
    this.connectLfo(lfoTarget);

    // Amp envelope: linear attack, exponential decay to sustain.
    const gain = this.amp.gain;
    gain.setValueAtTime(0, startTime);
    gain.linearRampToValueAtTime(1, startTime + this.env.attack);
    gain.setTargetAtTime(this.env.sustain, startTime + this.env.attack, segmentTimeConstant(this.env.decay));

    // Filter envelope: instant jump up, exponential decay back to cutoff.
    const peak = filterEnvPeakOctaves(patch['filter.cutoff'], patch['fenv.amount'], MAX_CUTOFF);
    this.filter.detune.setValueAtTime(octavesToCents(peak), startTime);
    if (peak > 0) {
      this.filter.detune.setTargetAtTime(0, startTime, segmentTimeConstant(patch['fenv.decay']));
    }

    // Declick fade-in.
    this.out.gain.setValueAtTime(0, startTime);
    this.out.gain.linearRampToValueAtTime(VOICE_GAIN, startTime + DECLICK_TIME);

    for (const source of this.sources()) source.start(startTime);

    this.ended = new Promise((resolve) => {
      this.osc1.onended = () => {
        for (const node of this.nodes) node.disconnect();
        resolve();
      };
    });
  }

  get endTime(): number {
    return this.end;
  }

  release(time: number): number {
    if (this.end !== Infinity) return this.end;
    const t = Math.max(time, this.startTime);
    const elapsed = t - this.startTime;
    const level = ampEnvelopeValue(this.env, elapsed);
    const gain = this.amp.gain;
    // Hold the envelope where it is at t, then let it fall. Inside the attack
    // the ramp is re-created up to t, because cancelling removes it entirely.
    gain.cancelScheduledValues(t);
    if (elapsed <= this.env.attack) gain.linearRampToValueAtTime(level, t);
    else gain.setValueAtTime(level, t);
    gain.setTargetAtTime(0, t, segmentTimeConstant(this.releaseSeconds));
    return this.fadeOut(Math.max(t + this.releaseSeconds, this.startTime + DECLICK_TIME));
  }

  stop(time: number): number {
    return this.fadeOut(Math.max(time, this.startTime));
  }

  update(patch: Readonly<Patch>, time: number): void {
    const t = Math.max(time, this.startTime);
    const previous = this.current;
    this.current = { ...patch };
    const changed = (id: ParamId): boolean => previous[id] !== patch[id];
    const smooth = (param: AudioParam, value: number): void => {
      param.setTargetAtTime(value, t, PARAM_SMOOTHING_TIME);
    };

    if (changed('osc.wave')) {
      this.osc1.type = OSC_TYPES[patch['osc.wave']];
      this.osc2.type = OSC_TYPES[patch['osc.wave']];
    }
    if (changed('osc.octave')) {
      const frequency = oscFrequency(this.note, patch);
      this.osc1.frequency.setValueAtTime(frequency, t);
      this.osc2.frequency.setValueAtTime(frequency, t);
      this.sub.frequency.setValueAtTime(subFrequency(this.note, patch), t);
    }
    if (changed('osc2.detune')) {
      smooth(this.osc1.detune, -patch['osc2.detune'] / 2);
      smooth(this.osc2.detune, patch['osc2.detune'] / 2);
    }
    if (changed('sub.level')) smooth(this.subGain.gain, patch['sub.level'] * SUB_MAX_GAIN);
    if (changed('noise.level')) smooth(this.noiseGain.gain, patch['noise.level'] * NOISE_MAX_GAIN);
    if (changed('filter.cutoff')) smooth(this.filter.frequency, patch['filter.cutoff']);
    if (changed('filter.resonance')) smooth(this.filter.Q, patch['filter.resonance'] * RESONANCE_MAX_DB);
    if (changed('drive.amount')) this.shaper.curve = driveCurve(patch['drive.amount']);
    if (changed('lfo.rate') || changed('lfo.sync') || changed('lfo.tempo')) smooth(this.lfo.frequency, lfoRateHz(patch));
    if (changed('lfo.target')) this.connectLfo(patch['lfo.target']);
    if (changed('lfo.target') || changed('lfo.depth')) {
      smooth(this.lfoGain.gain, lfoModulationAmount(patch['lfo.target'], patch['lfo.depth']));
      smooth(this.tremolo.gain, tremoloBaseGain(patch['lfo.target'], patch['lfo.depth']));
    }
    this.releaseSeconds = patch['amp.release'];
  }

  private sources(): AudioScheduledSourceNode[] {
    return [this.osc1, this.osc2, this.sub, this.noise, this.lfo];
  }

  private connectLfo(target: LfoTarget): void {
    this.lfoGain.disconnect();
    switch (target) {
      case 'off':
        break;
      case 'cutoff':
        this.lfoGain.connect(this.filter.detune);
        break;
      case 'pitch':
        this.lfoGain.connect(this.osc1.detune);
        this.lfoGain.connect(this.osc2.detune);
        this.lfoGain.connect(this.sub.detune);
        break;
      case 'amp':
        this.lfoGain.connect(this.tremolo.gain);
        break;
    }
  }

  /** Output gain implied by the fades scheduled so far. */
  private outGainAt(t: number): number {
    const fadeIn = Math.min(1, Math.max(0, (t - this.startTime) / DECLICK_TIME));
    const fadeOut = this.end === Infinity ? 1 : Math.min(1, Math.max(0, (this.end - t) / DECLICK_TIME));
    return VOICE_GAIN * Math.min(fadeIn, fadeOut);
  }

  /** Fade the output to silence over DECLICK_TIME from `fadeStart` and stop. Only ever moves the end earlier. */
  private fadeOut(fadeStart: number): number {
    const end = fadeStart + DECLICK_TIME;
    if (end >= this.end) return this.end;
    const gain = this.out.gain;
    const level = this.outGainAt(fadeStart);
    // The out gain only ever has linear segments, so re-ramping to the
    // current level after cancelling keeps it continuous.
    gain.cancelScheduledValues(fadeStart);
    gain.linearRampToValueAtTime(level, fadeStart);
    gain.linearRampToValueAtTime(0, end);
    for (const source of this.sources()) source.stop(end);
    this.end = end;
    return end;
  }
}

/**
 * Build and start a voice playing MIDI `note` from `startTime`. It holds
 * until `release` or `stop` is called.
 */
export function buildVoice(
  ctx: BaseAudioContext,
  patch: Readonly<Patch>,
  note: number,
  startTime: number,
  destination: AudioNode = ctx.destination,
): VoiceHandle {
  return new Voice(ctx, patch, note, startTime, destination);
}
