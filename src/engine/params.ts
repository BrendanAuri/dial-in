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

/** LFO sync: off (free-running, in Hz) or a note length at the patch's tempo, slowest first. T = triplet. */
export const LFO_SYNCS = ['off', '1/2', '1/4', '1/4T', '1/8', '1/8T', '1/16', '1/16T'] as const;
export type LfoSync = (typeof LFO_SYNCS)[number];

/** A complete set of synth settings. */
export interface Patch {
  'osc.wave': Waveform;
  'osc.octave': Octave;
  'osc2.detune': number;
  'sub.level': number;
  'noise.level': number;
  'filter.cutoff': number;
  'filter.resonance': number;
  'drive.amount': number;
  'fenv.amount': number;
  'fenv.decay': number;
  'amp.attack': number;
  'amp.decay': number;
  'amp.sustain': number;
  'amp.release': number;
  'lfo.target': LfoTarget;
  'lfo.sync': LfoSync;
  'lfo.rate': number;
  'lfo.tempo': number;
  'lfo.depth': number;
}

export type ParamId = keyof Patch;
export type DiscreteParamId = 'osc.wave' | 'osc.octave' | 'lfo.target' | 'lfo.sync';
export type ContinuousParamId = Exclude<ParamId, DiscreteParamId>;
export type DiscreteValue = Patch[DiscreteParamId];

export type EngineModule = 'osc' | 'osc2' | 'sub' | 'noise' | 'filter' | 'drive' | 'filterEnv' | 'ampEnv' | 'lfo';
export type Unit = 'Hz' | 's' | '%' | 'cents' | 'oct' | 'BPM';

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
  /** Values snap to multiples of this, if set. */
  readonly step?: number;
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
  'sub.level': {
    kind: 'continuous',
    id: 'sub.level',
    label: 'Sub',
    module: 'sub',
    scale: 'linear',
    min: 0,
    max: 1,
    default: 0,
    unit: '%',
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
  'drive.amount': {
    kind: 'continuous',
    id: 'drive.amount',
    label: 'Drive',
    module: 'drive',
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
  'lfo.sync': {
    kind: 'discrete',
    id: 'lfo.sync',
    label: 'Sync',
    module: 'lfo',
    options: [
      { value: 'off', label: 'Off' },
      { value: '1/2', label: '1/2' },
      { value: '1/4', label: '1/4' },
      { value: '1/4T', label: '1/4T' },
      { value: '1/8', label: '1/8' },
      { value: '1/8T', label: '1/8T' },
      { value: '1/16', label: '1/16' },
      { value: '1/16T', label: '1/16T' },
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
  'lfo.tempo': {
    kind: 'continuous',
    id: 'lfo.tempo',
    label: 'Tempo',
    module: 'lfo',
    scale: 'linear',
    min: 60,
    max: 200,
    default: 120,
    unit: 'BPM',
    step: 1,
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
  'sub.level',
  'noise.level',
  'filter.cutoff',
  'filter.resonance',
  'drive.amount',
  'fenv.amount',
  'fenv.decay',
  'amp.attack',
  'amp.decay',
  'amp.sustain',
  'amp.release',
  'lfo.target',
  'lfo.sync',
  'lfo.rate',
  'lfo.tempo',
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
  { id: 'sub', label: 'Sub' },
  { id: 'noise', label: 'Noise' },
  { id: 'filter', label: 'Filter' },
  { id: 'drive', label: 'Drive' },
  { id: 'filterEnv', label: 'Filter envelope' },
  { id: 'ampEnv', label: 'Amp envelope' },
  { id: 'lfo', label: 'LFO' },
];

/** Parameter ids that belong to a module, in display order. */
export function paramsInModule(module: EngineModule): ParamId[] {
  return PARAM_IDS.filter((id) => PARAMS[id].module === module);
}

/**
 * Whether a control does anything in this patch: the LFO's Rate only
 * applies with Sync off, and Tempo only with Sync on.
 */
export function isParamInUse(id: ParamId, patch: Readonly<Patch>): boolean {
  if (id === 'lfo.rate') return patch['lfo.sync'] === 'off';
  if (id === 'lfo.tempo') return patch['lfo.sync'] !== 'off';
  return true;
}

/** Labels that need their module to make sense on their own: shared ones, plus a few generic words. */
const CONTEXT_LABELS = new Set([
  ...PARAM_IDS.map((id) => PARAMS[id].label).filter((label, i, all) => all.indexOf(label) !== i),
  'Amount',
  'Rate',
  'Depth',
  'Target',
  'Sync',
]);

/** A control's name, with its module added where the label alone is unclear ("Amp envelope decay", "LFO rate"). */
export function controlName(id: ParamId): string {
  const def = PARAMS[id];
  if (!CONTEXT_LABELS.has(def.label)) return def.label;
  const module = MODULES.find((m) => m.id === def.module)?.label ?? def.module;
  return `${module} ${def.label.toLowerCase()}`;
}
