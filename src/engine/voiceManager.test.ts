import { describe, expect, it } from 'vitest';
import type { Patch } from './params';
import { DEFAULT_PATCH } from './patch';
import type { VoiceHandle } from './voice';
import { VoiceManager, type VoiceMode } from './voiceManager';

class FakeVoice implements VoiceHandle {
  readonly note: number;
  readonly startTime: number;
  readonly ended: Promise<void>;
  endTime = Infinity;
  releasedAt: number | null = null;
  stoppedAt: number | null = null;
  lastPatch: Readonly<Patch>;
  private resolve: () => void = () => undefined;

  constructor(patch: Readonly<Patch>, note: number, startTime: number) {
    this.note = note;
    this.startTime = startTime;
    this.lastPatch = patch;
    this.ended = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  release(time: number): number {
    if (this.endTime === Infinity) {
      this.releasedAt = time;
      this.endTime = time + 1;
    }
    return this.endTime;
  }

  stop(time: number): number {
    this.stoppedAt = time;
    this.endTime = Math.min(this.endTime, time + 0.005);
    return this.endTime;
  }

  update(patch: Readonly<Patch>): void {
    this.lastPatch = patch;
  }

  finish(): void {
    this.resolve();
  }
}

function setup(options: { maxVoices?: number; mode?: VoiceMode } = {}) {
  const voices: FakeVoice[] = [];
  const manager = new VoiceManager(
    (patch, note, time) => {
      const voice = new FakeVoice(patch, note, time);
      voices.push(voice);
      return voice;
    },
    DEFAULT_PATCH,
    { maxVoices: options.maxVoices ?? 8, mode: options.mode ?? 'poly' },
  );
  return { manager, voices };
}

const at = (voices: FakeVoice[], i: number): FakeVoice => {
  const voice = voices[i];
  if (!voice) throw new Error(`no voice ${i}`);
  return voice;
};

describe('poly', () => {
  it('plays and releases notes independently', () => {
    const { manager, voices } = setup();
    manager.noteOn(60, 0);
    manager.noteOn(64, 0.1);
    expect(manager.getHeldNotes()).toEqual([60, 64]);
    manager.noteOff(60, 0.5);
    expect(at(voices, 0).releasedAt).toBe(0.5);
    expect(at(voices, 1).releasedAt).toBeNull();
    expect(manager.getHeldNotes()).toEqual([64]);
  });

  it('retriggers a note that is already held', () => {
    const { manager, voices } = setup();
    manager.noteOn(60, 0);
    manager.noteOn(60, 0.2);
    expect(voices).toHaveLength(2);
    expect(at(voices, 0).stoppedAt).toBe(0.2);
    expect(manager.getHeldNotes()).toEqual([60]);
  });

  it('steals the oldest releasing voice first, then the oldest held one', () => {
    const { manager, voices } = setup({ maxVoices: 2 });
    manager.noteOn(60, 0);
    manager.noteOn(62, 0.1);
    manager.noteOff(62, 0.2);
    manager.noteOn(64, 0.3);
    expect(at(voices, 1).stoppedAt).toBe(0.3);
    expect(at(voices, 0).stoppedAt).toBeNull();
    manager.noteOn(65, 0.4);
    expect(at(voices, 0).stoppedAt).toBe(0.4);
    expect(manager.activeVoiceCount).toBe(2);
  });

  it('forgets voices once they have ended', async () => {
    const { manager, voices } = setup();
    manager.noteOn(60, 0);
    manager.noteOff(60, 0.1);
    expect(manager.activeVoiceCount).toBe(1);
    at(voices, 0).finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(manager.activeVoiceCount).toBe(0);
  });
});

describe('Hold', () => {
  it('keeps released keys sounding until Hold is turned off', () => {
    const { manager, voices } = setup();
    manager.setHold(true, 0);
    manager.noteOn(60, 0);
    manager.noteOff(60, 0.2);
    expect(at(voices, 0).releasedAt).toBeNull();
    expect(manager.getHeldNotes()).toEqual([60]);
    manager.setHold(false, 1);
    expect(at(voices, 0).releasedAt).toBe(1);
    expect(manager.getHeldNotes()).toEqual([]);
  });

  it('leaves keys that are still down sounding when Hold is turned off', () => {
    const { manager, voices } = setup();
    manager.setHold(true, 0);
    manager.noteOn(60, 0);
    manager.noteOn(64, 0);
    manager.noteOff(60, 0.1);
    manager.setHold(false, 0.5);
    expect(at(voices, 0).releasedAt).toBe(0.5);
    expect(at(voices, 1).releasedAt).toBeNull();
    manager.noteOff(64, 0.8);
    expect(at(voices, 1).releasedAt).toBe(0.8);
  });
});

describe('mono', () => {
  it('plays one note at a time with last-note priority', () => {
    const { manager, voices } = setup({ mode: 'mono' });
    manager.noteOn(60, 0);
    manager.noteOn(64, 0.1);
    expect(at(voices, 0).stoppedAt).toBe(0.1);
    expect(manager.getHeldNotes()).toEqual([64]);
    manager.noteOff(64, 0.2);
    expect(at(voices, 1).stoppedAt).toBe(0.2);
    expect(at(voices, 2).note).toBe(60);
    expect(manager.getHeldNotes()).toEqual([60]);
    manager.noteOff(60, 0.3);
    expect(at(voices, 2).releasedAt).toBe(0.3);
    expect(manager.getHeldNotes()).toEqual([]);
  });

  it('ignores releasing an older key while a newer one sounds', () => {
    const { manager, voices } = setup({ mode: 'mono' });
    manager.noteOn(60, 0);
    manager.noteOn(64, 0.1);
    manager.noteOff(60, 0.2);
    expect(voices).toHaveLength(2);
    expect(at(voices, 1).releasedAt).toBeNull();
    expect(manager.getHeldNotes()).toEqual([64]);
  });

  it('replaces the held note and sustains the new one with Hold on', () => {
    const { manager, voices } = setup({ mode: 'mono' });
    manager.setHold(true, 0);
    manager.noteOn(60, 0);
    manager.noteOff(60, 0.1);
    manager.noteOn(67, 0.5);
    manager.noteOff(67, 0.6);
    expect(at(voices, 0).stoppedAt).toBe(0.5);
    expect(manager.getHeldNotes()).toEqual([67]);
    manager.setHold(false, 1);
    expect(at(voices, 1).releasedAt).toBe(1);
  });
});

describe('short notes and control', () => {
  it('triggers a note that releases itself and is never held', () => {
    const { manager, voices } = setup();
    manager.trigger(48, 0, 1.5);
    expect(at(voices, 0).releasedAt).toBe(1.5);
    expect(manager.getHeldNotes()).toEqual([]);
  });

  it('cuts off the sounding note when triggering in mono', () => {
    const { manager, voices } = setup({ mode: 'mono' });
    manager.noteOn(60, 0);
    manager.trigger(48, 0.5, 1.5);
    expect(at(voices, 0).stoppedAt).toBe(0.5);
  });

  it('updates sounding voices and uses the new patch for new notes', () => {
    const { manager, voices } = setup();
    manager.noteOn(60, 0);
    const darker: Patch = { ...DEFAULT_PATCH, 'filter.cutoff': 300 };
    manager.setPatch(darker, 0.1);
    expect(at(voices, 0).lastPatch['filter.cutoff']).toBe(300);
    manager.noteOn(62, 0.2);
    expect(at(voices, 1).lastPatch['filter.cutoff']).toBe(300);
  });

  it('releases everything, including held notes, when the mode changes', () => {
    const { manager, voices } = setup();
    manager.setHold(true, 0);
    manager.noteOn(60, 0);
    manager.setMode('mono', 0.5);
    expect(at(voices, 0).releasedAt).toBe(0.5);
    expect(manager.holding).toBe(false);
    expect(manager.mode).toBe('mono');
  });

  it('silences everything on panic', () => {
    const { manager, voices } = setup();
    manager.noteOn(60, 0);
    manager.trigger(64, 0, 1);
    manager.panic(0.3);
    expect(voices.every((voice) => voice.stoppedAt === 0.3)).toBe(true);
    expect(manager.getHeldNotes()).toEqual([]);
  });

  it('notifies subscribers only when held notes change, with a stable snapshot', () => {
    const { manager } = setup();
    let calls = 0;
    const unsubscribe = manager.subscribe(() => calls++);
    manager.noteOn(60, 0);
    const snapshot = manager.getHeldNotes();
    manager.setPatch(DEFAULT_PATCH, 0.1);
    expect(manager.getHeldNotes()).toBe(snapshot);
    manager.noteOff(60, 0.2);
    expect(calls).toBe(2);
    unsubscribe();
    manager.noteOn(62, 0.3);
    expect(calls).toBe(2);
  });
});
