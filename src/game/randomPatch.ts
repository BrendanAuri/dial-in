/**
 * Musical random patches for Free Play's Randomise button. A stand-in until
 * the Foundations pack's sound-type templates exist (Milestone 6).
 */
import { RANDOMISE } from '../engine/constants';
import { LFO_TARGETS, OCTAVES, WAVEFORMS, type Patch } from '../engine/params';
import { patchFromRecord } from '../engine/patch';
import { chance, logUniform, pick, uniform, weightedPick, type Rng } from './rng';

type Range = readonly [number, number];

const lin = (rng: Rng, [min, max]: Range): number => uniform(rng, min, max);
const log = (rng: Rng, [min, max]: Range): number => logUniform(rng, min, max);

export function randomPatch(rng: Rng): Patch {
  const r = RANDOMISE;
  const lfoOn = chance(rng, r.lfoChance);
  const filterEnvOn = chance(rng, r.filterEnvChance);
  return patchFromRecord({
    'osc.wave': pick(rng, WAVEFORMS),
    'osc.octave': weightedPick(rng, OCTAVES, r.octaveWeights),
    'osc2.detune': chance(rng, r.detuneChance) ? lin(rng, r.detune) : 0,
    'noise.level': chance(rng, r.noiseChance) ? lin(rng, r.noise) : 0,
    'filter.cutoff': log(rng, r.cutoff),
    'filter.resonance': lin(rng, r.resonance),
    'fenv.amount': filterEnvOn ? lin(rng, r.filterEnvAmount) : 0,
    'fenv.decay': log(rng, r.filterEnvDecay),
    'amp.attack': chance(rng, r.fastAttackChance) ? log(rng, r.fastAttack) : log(rng, r.slowAttack),
    'amp.decay': log(rng, r.decay),
    'amp.sustain': lin(rng, r.sustain),
    'amp.release': log(rng, r.release),
    'lfo.target': lfoOn ? pick(rng, LFO_TARGETS.filter((t) => t !== 'off')) : 'off',
    'lfo.rate': log(rng, r.lfoRate),
    'lfo.depth': lfoOn ? lin(rng, r.lfoDepth) : 0,
  });
}
