/**
 * Live note handling for Free Play: note on/off, polyphony with voice
 * stealing, mono mode with last-note priority, Hold (works like a sustain
 * pedal) and short triggered notes.
 *
 * Voices come from an injected factory, so the allocation logic can be
 * tested without Web Audio.
 */
import type { Patch } from './params';
import type { VoiceHandle } from './voice';

export type VoiceMode = 'poly' | 'mono';
export type VoiceFactory = (patch: Readonly<Patch>, note: number, startTime: number) => VoiceHandle;

/** held: sounding because a key is down or Hold is on. releasing: in its release stage. stopping: fading out fast. */
type SlotState = 'held' | 'releasing' | 'stopping';

interface Slot {
  readonly note: number;
  readonly voice: VoiceHandle;
  readonly order: number;
  state: SlotState;
}

export interface VoiceManagerOptions {
  readonly maxVoices: number;
  readonly mode?: VoiceMode;
}

export class VoiceManager {
  private readonly factory: VoiceFactory;
  private readonly maxVoices: number;
  private patch: Patch;
  private currentMode: VoiceMode;
  private hold = false;
  private slots: Slot[] = [];
  /** Keys physically down, in press order. */
  private keysDown: number[] = [];
  private nextOrder = 0;
  private heldSnapshot: readonly number[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(factory: VoiceFactory, patch: Readonly<Patch>, options: VoiceManagerOptions) {
    this.factory = factory;
    this.patch = { ...patch };
    this.maxVoices = options.maxVoices;
    this.currentMode = options.mode ?? 'poly';
  }

  get mode(): VoiceMode {
    return this.currentMode;
  }

  get holding(): boolean {
    return this.hold;
  }

  /** Number of voices still making sound (held or releasing). */
  get activeVoiceCount(): number {
    return this.slots.filter((slot) => slot.state !== 'stopping').length;
  }

  /** Notes currently held (by a key or by Hold), sorted. Same array until it changes. */
  readonly getHeldNotes = (): readonly number[] => this.heldSnapshot;

  /** Subscribe to changes in held notes. Returns an unsubscribe function. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** New notes use this patch; sounding voices are updated from `time`. */
  setPatch(patch: Readonly<Patch>, time: number): void {
    this.patch = { ...patch };
    for (const slot of this.slots) {
      if (slot.state !== 'stopping') slot.voice.update(this.patch, time);
    }
  }

  /** Switching mode releases everything, including notes kept by Hold. */
  setMode(mode: VoiceMode, time: number): void {
    if (mode === this.currentMode) return;
    this.hold = false;
    this.allNotesOff(time);
    this.currentMode = mode;
  }

  noteOn(note: number, time: number): void {
    this.keysDown = [...this.keysDown.filter((n) => n !== note), note];
    if (this.currentMode === 'mono') {
      this.playMono(note, time);
    } else {
      for (const slot of this.slots) {
        if (slot.note === note && slot.state === 'held') this.stopSlot(slot, time);
      }
      this.makeRoom(time);
      this.startSlot(note, time, 'held');
    }
    this.notify();
  }

  noteOff(note: number, time: number): void {
    const wasTop = this.keysDown[this.keysDown.length - 1] === note;
    this.keysDown = this.keysDown.filter((n) => n !== note);
    if (this.hold) return;
    if (this.currentMode === 'mono') {
      const sounding = this.heldSlots()[0];
      if (!wasTop || sounding?.note !== note) return;
      const previous = this.keysDown[this.keysDown.length - 1];
      if (previous !== undefined) this.playMono(previous, time);
      else this.releaseSlot(sounding, time);
    } else {
      for (const slot of this.slots) {
        if (slot.note === note && slot.state === 'held') this.releaseSlot(slot, time);
      }
    }
    this.notify();
  }

  /**
   * Hold on: released keys keep sounding. Hold off: release every held note
   * whose key isn't down (in mono, fall back to the last key still down).
   */
  setHold(on: boolean, time: number): void {
    if (on === this.hold) return;
    this.hold = on;
    if (on) return;
    if (this.currentMode === 'mono') {
      const sounding = this.heldSlots()[0];
      const top = this.keysDown[this.keysDown.length - 1];
      if (sounding && sounding.note !== top) {
        if (top !== undefined) this.playMono(top, time);
        else this.releaseSlot(sounding, time);
      }
    } else {
      for (const slot of this.heldSlots()) {
        if (!this.keysDown.includes(slot.note)) this.releaseSlot(slot, time);
      }
    }
    this.notify();
  }

  /** A short note that releases by itself after `duration` seconds. Never counts as held. */
  trigger(note: number, time: number, duration: number): void {
    if (this.currentMode === 'mono') {
      for (const slot of this.slots) this.stopSlot(slot, time);
    } else {
      this.makeRoom(time);
    }
    const voice = this.startSlot(note, time, 'releasing');
    voice.release(time + duration);
    this.notify();
  }

  /** Release every held note (keys and Hold). Keys still down are treated as released. */
  allNotesOff(time: number): void {
    this.keysDown = [];
    for (const slot of this.heldSlots()) this.releaseSlot(slot, time);
    this.notify();
  }

  /** Silence everything immediately. */
  panic(time: number): void {
    this.keysDown = [];
    this.hold = false;
    for (const slot of this.slots) this.stopSlot(slot, time);
    this.notify();
  }

  private heldSlots(): Slot[] {
    return this.slots.filter((slot) => slot.state === 'held');
  }

  /** Mono: fade out whatever is sounding and start `note` as the one held voice. */
  private playMono(note: number, time: number): void {
    for (const slot of this.slots) this.stopSlot(slot, time);
    this.startSlot(note, time, 'held');
  }

  /** Steal voices until a new one fits: oldest releasing voice first, then oldest held. */
  private makeRoom(time: number): void {
    while (this.activeVoiceCount >= this.maxVoices) {
      const active = this.slots.filter((slot) => slot.state !== 'stopping');
      const victim =
        active.filter((slot) => slot.state === 'releasing').sort((a, b) => a.order - b.order)[0] ??
        active.sort((a, b) => a.order - b.order)[0];
      if (!victim) return;
      this.stopSlot(victim, time);
    }
  }

  private startSlot(note: number, time: number, state: SlotState): VoiceHandle {
    const voice = this.factory(this.patch, note, time);
    const slot: Slot = { note, voice, order: this.nextOrder++, state };
    this.slots.push(slot);
    void voice.ended.then(() => {
      this.slots = this.slots.filter((s) => s !== slot);
      this.notify();
    });
    return voice;
  }

  private releaseSlot(slot: Slot, time: number): void {
    if (slot.state !== 'held') return;
    slot.state = 'releasing';
    slot.voice.release(time);
  }

  private stopSlot(slot: Slot, time: number): void {
    if (slot.state === 'stopping') return;
    slot.state = 'stopping';
    slot.voice.stop(time);
  }

  private notify(): void {
    const held = [...new Set(this.heldSlots().map((slot) => slot.note))].sort((a, b) => a - b);
    const changed =
      held.length !== this.heldSnapshot.length || held.some((note, i) => note !== this.heldSnapshot[i]);
    if (!changed) return;
    this.heldSnapshot = held;
    for (const listener of this.listeners) listener();
  }
}
