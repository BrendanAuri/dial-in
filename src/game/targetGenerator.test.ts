import { describe, expect, it } from 'vitest';
import { PACKS } from '../content';
import type { Level } from '../content/schema';
import { DEFAULT_HOLD_TIME, TARGET_MAX_ATTEMPTS, TARGET_MIN_START_DISTANCE } from '../engine/constants';
import { noteNameToMidi } from '../engine/notes';
import { PARAMS, PARAM_IDS } from '../engine/params';
import { DEFAULT_PATCH } from '../engine/patch';
import { FIXTURE_PACK } from './fixtures';
import { findLevel, packLevels } from './packs';
import { isAudible } from '../scoring/audible';
import { paramDistance } from '../scoring/paramScore';
import { estimateLoudness } from './targetChecks';
import { generateRound, startingPatch } from './targetGenerator';

function level(id: string): Level {
  const found = findLevel(FIXTURE_PACK, id);
  if (!found) throw new Error(id);
  return found;
}

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

describe('generateRound', () => {
  it('is identical for the same seed and differs between seeds', () => {
    const a = generateRound(FIXTURE_PACK, level('cutoff'), 1234);
    expect(generateRound(FIXTURE_PACK, level('cutoff'), 1234)).toEqual(a);
    const others = SEEDS.slice(0, 20).map((seed) => generateRound(FIXTURE_PACK, level('cutoff'), seed).target['filter.cutoff']);
    expect(new Set(others).size).toBeGreaterThan(15);
  });

  it('starts the knobs at the fixed values over the defaults', () => {
    expect(startingPatch(level('cutoff'))).toEqual({ ...DEFAULT_PATCH, 'filter.cutoff': 5000, 'amp.release': 0.5 });
  });

  it('only changes unlocked controls', () => {
    for (const seed of SEEDS) {
      const round = generateRound(FIXTURE_PACK, level('cutoff'), seed);
      for (const id of PARAM_IDS) {
        if (!round.unlocked.includes(id)) expect(round.target[id]).toBe(round.start[id]);
      }
    }
  });

  it('keeps values inside the generator ranges and choices', () => {
    for (const seed of SEEDS) {
      const { target } = generateRound(FIXTURE_PACK, level('cutoff'), seed);
      expect(target['filter.cutoff']).toBeGreaterThanOrEqual(200);
      expect(target['filter.cutoff']).toBeLessThanOrEqual(2000);
      expect(['saw', 'square']).toContain(target['osc.wave']);
      expect([-1, 0, 1]).toContain(target['osc.octave']);
    }
  });

  it('uses the off value some of the time when there is an off chance', () => {
    const cutoffs = SEEDS.map((seed) => generateRound(FIXTURE_PACK, level('lfo'), seed).target['filter.cutoff']);
    expect(cutoffs.filter((c) => c === 12000).length).toBeGreaterThan(30);
    expect(cutoffs.filter((c) => c >= 200 && c <= 2000).length).toBeGreaterThan(30);
  });

  it('picks notes inside the level range', () => {
    const low = noteNameToMidi('C3');
    const high = noteNameToMidi('C4');
    const notes = SEEDS.map((seed) => generateRound(FIXTURE_PACK, level('wave'), seed).note);
    expect(Math.min(...notes)).toBe(low);
    expect(Math.max(...notes)).toBe(high);
    expect(generateRound(FIXTURE_PACK, level('cutoff'), 5).note).toBe(noteNameToMidi('A2'));
  });

  it('moves at least one of the level’s new controls audibly away from the start', () => {
    for (const id of ['cutoff', 'lfo']) {
      const current = level(id);
      for (const seed of SEEDS) {
        const round = generateRound(FIXTURE_PACK, current, seed);
        const context = { note: round.note, holdTime: DEFAULT_HOLD_TIME };
        const moved = current.newControls.some(
          (control) =>
            isAudible(control, round.target, context) &&
            paramDistance(control, round.start, round.target) >= TARGET_MIN_START_DISTANCE,
        );
        expect(moved, `${id} seed ${seed}`).toBe(true);
      }
    }
  });

  it('never counts an LFO with no depth as a change', () => {
    for (const seed of SEEDS) {
      expect(generateRound(FIXTURE_PACK, level('lfo'), seed).target['lfo.depth']).toBeGreaterThan(0);
    }
  });
});

describe('templates', () => {
  it('picks a template per round and uses its settings and note range', () => {
    const rounds = SEEDS.map((seed) => generateRound(FIXTURE_PACK, level('lfo'), seed));
    const low = rounds.filter((r) => r.template === 'low');
    const high = rounds.filter((r) => r.template === 'high');
    expect(low.length).toBeGreaterThan(50);
    expect(high.length).toBeGreaterThan(50);
    for (const r of low) {
      expect(r.target['osc.wave']).toBe('sine');
      expect(r.note).toBeGreaterThanOrEqual(noteNameToMidi('C1'));
      expect(r.note).toBeLessThanOrEqual(noteNameToMidi('C2'));
    }
    for (const r of high) {
      expect(r.target['osc.wave']).toBe('saw');
      expect(r.note).toBeGreaterThanOrEqual(noteNameToMidi('C3'));
    }
  });

  it('reports no template for levels without any', () => {
    expect(generateRound(FIXTURE_PACK, level('wave'), 1).template).toBeNull();
  });

  it('builds Foundations sound-type rounds from every template', () => {
    for (const pack of PACKS) {
      for (const lvl of packLevels(pack)) {
        const templates = lvl.generator.templates ?? [];
        if (templates.length === 0) continue;
        const used = new Set(SEEDS.map((seed) => generateRound(pack, lvl, seed).template));
        for (const template of templates) expect(used, template.id).toContain(template.id);
      }
    }
  });
});

describe('estimateLoudness', () => {
  it('treats the default patch as full level for the whole note', () => {
    const loudness = estimateLoudness(DEFAULT_PATCH, 48, DEFAULT_HOLD_TIME);
    expect(loudness.peakDb).toBeCloseTo(0, 1);
    expect(loudness.audibleSeconds).toBeGreaterThan(DEFAULT_HOLD_TIME);
  });

  it('counts a cutoff far below the note as quiet', () => {
    const dark = { ...DEFAULT_PATCH, 'filter.cutoff': 40 };
    expect(estimateLoudness(dark, 72, DEFAULT_HOLD_TIME).peakDb).toBeLessThan(-40);
  });

  it('lets the filter envelope open a dark patch', () => {
    const pluck = { ...DEFAULT_PATCH, 'filter.cutoff': 40, 'fenv.amount': 5, 'fenv.decay': 0.3 };
    expect(estimateLoudness(pluck, 72, DEFAULT_HOLD_TIME).peakDb).toBeGreaterThan(-10);
  });

  it('measures how long a short blip lasts', () => {
    const blip = { ...DEFAULT_PATCH, 'amp.sustain': 0, 'amp.decay': 0.01, 'amp.release': 0.01 };
    expect(estimateLoudness(blip, 60, DEFAULT_HOLD_TIME).audibleSeconds).toBeLessThan(0.05);
  });

  it('caps the level at what a long attack reaches before release', () => {
    const swell = { ...DEFAULT_PATCH, 'amp.attack': 2 };
    expect(estimateLoudness(swell, 60, 1).peakDb).toBeCloseTo(20 * Math.log10(0.5), 1);
  });
});

describe('shipped levels', () => {
  it('generate fair targets without running out of attempts', () => {
    for (const pack of PACKS) {
      for (const lvl of packLevels(pack)) {
        const exhausted = SEEDS.filter((seed) => generateRound(pack, lvl, seed).attempts >= TARGET_MAX_ATTEMPTS);
        expect(exhausted, `${pack.id}/${lvl.id}`).toEqual([]);
      }
    }
  });

  it('only reference known parameters within their ranges', () => {
    for (const pack of PACKS) {
      for (const lvl of packLevels(pack)) {
        for (const id of lvl.newControls) expect(PARAM_IDS).toContain(id);
        for (const [id, gen] of Object.entries(lvl.generator.params)) {
          const def = PARAMS[id as keyof typeof PARAMS];
          expect(def, id).toBeDefined();
          if (gen.kind === 'range' && def.kind === 'continuous') {
            expect(gen.min, id).toBeGreaterThanOrEqual(def.min);
            expect(gen.max, id).toBeLessThanOrEqual(def.max);
          }
        }
      }
    }
  });
});
