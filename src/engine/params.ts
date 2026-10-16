/**
 * Parameter schema: ids, ranges, scales, defaults and the engine module each
 * parameter belongs to. Which level introduces a control is pack data, not
 * part of this schema.
 *
 * Engine growth rule: every parameter added after v1 must default to a
 * neutral value (off / no effect) so saved sounds keep sounding the same.
 */

export const WAVEFORMS = ['sine', 'triangle', 'saw', 'square'] as const;
export type Waveform = (typeof WAVEFORMS)[number];

export const OCTAVES = [-1, 0, 1] as const;
export type Octave = (typeof OCTAVES)[number];

export const LFO_TARGETS = ['off', 'cutoff', 'pitch', 'amp'] as const;
export type LfoTarget = (typeof LFO_TARGETS)[number];

/** A complete set of synth settings. */
export interface Patch {
  'osc.wave': Waveform;
  'osc.octave': Octave;
  'osc2.detune': number;
  'noise.level': number;
  'filter.cutoff': number;
  'filter.resonance': number;
  'fenv.amount': number;
  'fenv.decay': number;
  'amp.attack': number;
  'amp.decay': number;
  'amp.sustain': number;
  'amp.release': number;
  'lfo.target': LfoTarget;
  'lfo.rate': number;
  'lfo.depth': number;
}

export type ParamId = keyof Patch;
export type DiscreteParamId = 'osc.wave' | 'osc.octave' | 'lfo.target';
export type ContinuousParamId = Exclude<ParamId, DiscreteParamId>;
export type DiscreteValue = Patch[DiscreteParamId];

export type EngineModule = 'osc' | 'osc2' | 'noise' | 'filter' | 'filterEnv' | 'ampEnv' | 'lfo';
export type Unit = 'Hz' | 's' | '%' | 'cents' | 'oct';

export interface ContinuousParamDef {
  readonly kind: 'continuous';
  readonly id: ContinuousParamId;
  readonly label: string;
  readonly module: EngineModule;
  readonly scale: 'linear' | 'log';
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly unit: Unit;
}

export interface DiscreteOption<V> {
  readonly value: V;
  readonly label: string;
}

export interface DiscreteParamDef<K extends DiscreteParamId = DiscreteParamId> {
  readonly kind: 'discrete';
  readonly id: K;
  readonly label: string;
  readonly module: EngineModule;
  readonly options: readonly DiscreteOption<Patch[K]>[];
  readonly default: Patch[K];
}

export type ParamDef<K extends ParamId = ParamId> = K extends DiscreteParamId
  ? DiscreteParamDef<K>
  : ContinuousParamDef;

export const PARAMS: { readonly [K in ParamId]: ParamDef<K> } = {
  'osc.wave': {
    kind: 'discrete',
    id: 'osc.wave',
    label: 'Waveform',
    module: 'osc',
    options: [
      { value: 'sine', label: 'Sine' },
      { value: 'triangle', label: 'Triangle' },
      { value: 'saw', label: 'Saw' },
      { value: 'square', label: 'Square' },
    ],
    default: 'saw',
  },
  'osc.octave': {
    kind: 'discrete',
    id: 'osc.octave',
    label: 'Octave',
    module: 'osc',
    options: [
      { value: -1, label: '−1' },
      { value: 0, label: '0' },
      { value: 1, label: '+1' },
    ],
    default: 0,
  },
  'osc2.detune': {
    kind: 'continuous',
    id: 'osc2.detune',
    label: 'Detune',
    module: 'osc2',
    scale: 'linear',
    min: 0,
    max: 50,
    default: 0,
    unit: 'cents',
  },
  'noise.level': {
    kind: 'continuous',
    id: 'noise.level',
    label: 'Noise',
    module: 'noise',
    scale: 'linear',
    min: 0,
    max: 1,
    default: 0,
    unit: '%',
  },
  'filter.cutoff': {
    kind: 'continuous',
    id: 'filter.cutoff',
    label: 'Cutoff',
    module: 'filter',
    scale: 'log',
    min: 40,
    max: 18000,
    default: 18000,
    unit: 'Hz',
  },
  'filter.resonance': {
    kind: 'continuous',
    id: 'filter.resonance',
    label: 'Resonance',
    module: 'filter',
    scale: 'linear',
    min: 0,
    max: 1,
    default: 0,
    unit: '%',
  },
  'fenv.amount': {
    kind: 'continuous',
    id: 'fenv.amount',
    label: 'Amount',
    module: 'filterEnv',
    scale: 'linear',
    min: 0,
    max: 5,
    default: 0,
    unit: 'oct',
  },
  'fenv.decay': {
    kind: 'continuous',
    id: 'fenv.decay',
    label: 'Decay',
    module: 'filterEnv',
    scale: 'log',
    min: 0.01,
    max: 2,
    default: 0.3,
    unit: 's',
  },
  'amp.attack': {
    kind: 'continuous',
    id: 'amp.attack',
    label: 'Attack',
    module: 'ampEnv',
    scale: 'log',
    min: 0.001,
    max: 2,
    default: 0.005,
    unit: 's',
  },
  'amp.decay': {
    kind: 'continuous',
    id: 'amp.decay',
    label: 'Decay',
    module: 'ampEnv',
    scale: 'log',
    min: 0.01,
    max: 2,
    default: 0.3,
    unit: 's',
  },
  'amp.sustain': {
    kind: 'continuous',
    id: 'amp.sustain',
    label: 'Sustain',
    module: 'ampEnv',
    scale: 'linear',
    min: 0,
    max: 1,
    default: 1,
    unit: '%',
  },
  'amp.release': {
    kind: 'continuous',
    id: 'amp.release',
    label: 'Release',
    module: 'ampEnv',
    scale: 'log',
    min: 0.01,
    max: 3,
    default: 0.1,
    unit: 's',
  },
  'lfo.target': {
    kind: 'discrete',
    id: 'lfo.target',
    label: 'Target',
    module: 'lfo',
    options: [
      { value: 'off', label: 'Off' },
      { value: 'cutoff', label: 'Cutoff' },
      { value: 'pitch', label: 'Pitch' },
      { value: 'amp', label: 'Amp' },
    ],
    default: 'off',
  },
  'lfo.rate': {
    kind: 'continuous',
    id: 'lfo.rate',
    label: 'Rate',
    module: 'lfo',
    scale: 'log',
    min: 0.1,
    max: 20,
    default: 2,
    unit: 'Hz',
  },
  'lfo.depth': {
    kind: 'continuous',
    id: 'lfo.depth',
    label: 'Depth',
    module: 'lfo',
    scale: 'linear',
    min: 0,
    max: 1,
    default: 0,
    unit: '%',
  },
};

/** Every parameter id, in display order. */
export const PARAM_IDS: readonly ParamId[] = [
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

export function isContinuousId(id: ParamId): id is ContinuousParamId {
  return PARAMS[id].kind === 'continuous';
}

export const CONTINUOUS_PARAM_IDS: readonly ContinuousParamId[] = PARAM_IDS.filter(isContinuousId);

/** Engine modules in display order, with their panel titles. */
export const MODULES: readonly { readonly id: EngineModule; readonly label: string }[] = [
  { id: 'osc', label: 'Oscillator' },
  { id: 'osc2', label: 'Osc 2' },
  { id: 'noise', label: 'Noise' },
  { id: 'filter', label: 'Filter' },
  { id: 'filterEnv', label: 'Filter envelope' },
  { id: 'ampEnv', label: 'Amp envelope' },
  { id: 'lfo', label: 'LFO' },
];

/** Parameter ids that belong to a module, in display order. */
export function paramsInModule(module: EngineModule): ParamId[] {
  return PARAM_IDS.filter((id) => PARAMS[id].module === module);
}
