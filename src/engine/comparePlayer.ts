/**
 * Round playback: play the target, play yours, or A/B both in sync and
 * flip between them mid-note. Each side has its own gain, so flipping is a
 * short crossfade rather than a restart.
 */
import { AB_CROSSFADE_TIME } from './constants';
import type { Patch } from './params';
import { buildVoice, type VoiceHandle } from './voice';

export type Side = 'target' | 'mine';

export interface CompareState {
  /** What's playing: one side, both in sync (A/B), or nothing. */
  readonly playing: Side | 'ab' | null;
  /** Which side you can hear right now. */
  readonly hearing: Side | null;
}

export interface ComparePatches {
  readonly target: Readonly<Patch>;
  readonly mine: Readonly<Patch>;
}

const IDLE: CompareState = { playing: null, hearing: null };

export class ComparePlayer {
  private readonly ctx: BaseAudioContext;
  private readonly gains: Record<Side, GainNode>;
  private voices: Partial<Record<Side, VoiceHandle>> = {};
  private state: CompareState = IDLE;
  private playback = 0;
  private readonly listeners = new Set<() => void>();

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.gains = {
      target: new GainNode(ctx, { gain: 0 }),
      mine: new GainNode(ctx, { gain: 0 }),
    };
    this.gains.target.connect(output);
    this.gains.mine.connect(output);
  }

  readonly getState = (): CompareState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Play one side for `holdTime` seconds from `time`. */
  play(side: Side, patches: ComparePatches, note: number, time: number, holdTime: number): void {
    this.start([side], patches, note, time, holdTime, side);
  }

  /** Play both sides in sync, hearing `hearing` first. */
  playAB(patches: ComparePatches, note: number, time: number, holdTime: number, hearing: Side = 'target'): void {
    this.start(['target', 'mine'], patches, note, time, holdTime, hearing);
  }

  /** During A/B, switch to the other side. Returns false if A/B isn't playing. */
  flip(time: number): boolean {
    if (this.state.playing !== 'ab' || this.state.hearing === null) return false;
    const next: Side = this.state.hearing === 'target' ? 'mine' : 'target';
    this.listen(next, time);
    this.setState({ playing: 'ab', hearing: next });
    return true;
  }

  /** Apply knob changes to your sounding note. */
  updateMine(patch: Readonly<Patch>, time: number): void {
    this.voices.mine?.update(patch, time);
  }

  stop(time: number): void {
    this.playback++;
    for (const voice of Object.values(this.voices)) voice.stop(time);
    this.voices = {};
    this.setState(IDLE);
  }

  private start(sides: readonly Side[], patches: ComparePatches, note: number, time: number, holdTime: number, hearing: Side): void {
    for (const voice of Object.values(this.voices)) voice.stop(time);
    const id = ++this.playback;
    this.voices = {};
    for (const side of sides) {
      const voice = buildVoice(this.ctx, patches[side], note, time, this.gains[side]);
      voice.release(time + holdTime);
      this.voices[side] = voice;
    }
    this.listen(hearing, time);
    this.setState({ playing: sides.length > 1 ? 'ab' : hearing, hearing });
    void Promise.all(Object.values(this.voices).map((voice) => voice.ended)).then(() => {
      if (this.playback !== id) return;
      this.voices = {};
      this.setState(IDLE);
    });
  }

  /** Crossfade so only `side` is audible. */
  private listen(side: Side, time: number): void {
    for (const s of ['target', 'mine'] as const) {
      this.gains[s].gain.setTargetAtTime(s === side ? 1 : 0, time, AB_CROSSFADE_TIME);
    }
  }

  private setState(state: CompareState): void {
    if (state.playing === this.state.playing && state.hearing === this.state.hearing) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
