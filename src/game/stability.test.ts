/**
 * Foundations rounds must never change: dailies, replay codes and level
 * runs in progress all depend on them. If a fingerprint here changes, an
 * engine or generator change has altered existing rounds.
 */
import { describe, expect, it } from 'vitest';
import { FOUNDATIONS_PACK } from '../content/packs/foundations';
import type { ParamId } from '../engine/params';
import { packLevels } from './packs';
import { hashString } from './rng';
import { generateRound } from './targetGenerator';

/** The v1 controls: everything the Foundations pack uses. */
const V1_CONTROLS: readonly ParamId[] = [
  'osc.wave',
  'osc.octave',
  'osc2.detune',
  'noise.level',
  'filter.cutoff',
  'filter.resonance',
  'fenv.amount',
  'fenv.decay',
  'amp.attack',
  'amp.decay',
  'amp.sustain',
  'amp.release',
  'lfo.target',
  'lfo.rate',
  'lfo.depth',
];

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 104729 + 17);

/** Recorded before the Bass Music pack added engine modules (2026-10-18). */
const FINGERPRINTS: Readonly<Record<string, number>> = {
  waveforms: 1886569020,
  brightness: 44211693,
  resonance: 585403648,
  'start-and-end': 573775986,
  'full-adsr': 1814349508,
  'plucks-and-sweeps': 446178463,
  movement: 921873291,
  thickness: 4012205785,
  'air-and-grit': 2649379027,
  'sound-types': 1849393722,
};

function fingerprint(levelId: string): number {
  const level = packLevels(FOUNDATIONS_PACK).find((l) => l.id === levelId);
  if (!level) throw new Error(levelId);
  const rounds = SEEDS.map((seed) => {
    const round = generateRound(FOUNDATIONS_PACK, level, seed);
    return [round.note, round.template, round.attempts, V1_CONTROLS.map((id) => round.target[id])];
  });
  return hashString(JSON.stringify(rounds));
}

describe('Foundations stability', () => {
  it.each(packLevels(FOUNDATIONS_PACK).map((level) => level.id))('%s generates the same rounds as before', (levelId) => {
    expect(fingerprint(levelId)).toBe(FINGERPRINTS[levelId]);
  });
});

describe('engine growth', () => {
  it('leaves controls added after v1 at their neutral defaults in every Foundations round', () => {
    for (const level of packLevels(FOUNDATIONS_PACK)) {
      for (const seed of SEEDS) {
        const { target } = generateRound(FOUNDATIONS_PACK, level, seed);
        expect([target['sub.level'], target['drive.amount'], target['lfo.sync']], level.id).toEqual([0, 0, 'off']);
      }
    }
  });
});
