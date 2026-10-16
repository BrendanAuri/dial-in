/**
 * Every tunable number in the app lives here. Parameter ranges and defaults
 * live in the parameter schema (params.ts).
 */

// ── Pitch ────────────────────────────────────────────────────────────────
export const A4_MIDI = 69;
export const A4_HZ = 440;
/** MIDI note number of C0, so C4 (middle C) = 60. */
export const MIDI_C0 = 12;
export const SEMITONES_PER_OCTAVE = 12;
export const CENTS_PER_SEMITONE = 100;
export const CENTS_PER_OCTAVE = 1200;

// ── Notes and timing ─────────────────────────────────────────────────────
/** How long a round's note (and Free Play's short Play) is held before release, in seconds. */
export const DEFAULT_HOLD_TIME = 1.5;
export const DEFAULT_NOTE = 'C3';
/** Live notes are scheduled this far ahead of currentTime, in seconds. */
export const LIVE_START_DELAY = 0.01;

// ── Free Play ────────────────────────────────────────────────────────────
/** Most voices sounding at once; the oldest is stolen beyond this. */
export const MAX_VOICES = 8;
/** Octave of the keyboard's lowest C when Free Play first opens. */
export const DEFAULT_KEYBOARD_OCTAVE = 3;
export const KEYBOARD_OCTAVE_RANGE = [0, 6] as const;
/** Viewport width (CSS px) from which the on-screen keyboard shows two octaves instead of one. */
export const KEYBOARD_TWO_OCTAVE_MIN_WIDTH = 640;
/** Undo steps kept. */
export const UNDO_LIMIT = 100;
/** Changes to the same control closer together than this become one undo step, in ms. */
export const UNDO_COALESCE_MS = 600;
/** Delay before the working sound is written to storage after a change, in ms. */
export const SESSION_SAVE_DELAY_MS = 300;
/** How long status messages stay on screen, in ms. */
export const TOAST_MS = 2500;

// ── Sound library ────────────────────────────────────────────────────────
export const LIBRARY_SCHEMA_VERSION = 1;
export const SESSION_SCHEMA_VERSION = 1;
export const SOUND_NAME_MAX_LENGTH = 60;
export const SOUND_TAG_MAX_LENGTH = 24;
export const SOUND_MAX_TAGS = 8;
/** Suggest a backup export after this many saves since the last one. */
export const BACKUP_NUDGE_SAVES = 10;

// ── Randomise ────────────────────────────────────────────────────────────
/**
 * Musical ranges for Free Play's Randomise button. A stand-in until the
 * Foundations pack's sound-type templates exist (Milestone 6).
 * Pairs are [min, max]; chances are probabilities.
 */
export const RANDOMISE = {
  octaveWeights: [0.25, 0.5, 0.25],
  detuneChance: 0.5,
  detune: [3, 30],
  noiseChance: 0.3,
  noise: [0.05, 0.4],
  cutoff: [150, 8000],
  resonance: [0, 0.7],
  filterEnvChance: 0.5,
  filterEnvAmount: [0.5, 4],
  filterEnvDecay: [0.05, 1],
  fastAttackChance: 0.7,
  fastAttack: [0.001, 0.05],
  slowAttack: [0.05, 1.5],
  decay: [0.05, 1.5],
  sustain: [0, 1],
  release: [0.02, 1.5],
  lfoChance: 0.4,
  lfoRate: [0.3, 10],
  lfoDepth: [0.1, 0.7],
} as const;

// ── Envelopes ────────────────────────────────────────────────────────────
/**
 * An exponential envelope segment of length T uses setTargetAtTime with a
 * time constant of T / this value, so it is about 99 % complete after T.
 */
export const ENV_TIME_CONSTANTS_PER_SEGMENT = 4.6;
/** Linear fade at the very start and end of every voice, to avoid clicks. */
export const DECLICK_TIME = 0.005;

// ── Voice mix ────────────────────────────────────────────────────────────
/** Gain of each oscillator. Osc 1 and osc 2 at 0 cents detune sum to 1. */
export const OSC_MIX_GAIN = 0.5;
/** Gain of the noise source when noise level is at 100 %. */
export const NOISE_MAX_GAIN = 0.5;
/** Resonance 0–1 maps linearly to lowpass Q of 0 dB up to this. */
export const RESONANCE_MAX_DB = 18;
/** Output gain of a single voice. */
export const VOICE_GAIN = 0.5;
/** Fixed gain of the master bus. */
export const MASTER_GAIN = 0.6;

// ── LFO depth at 100 % ───────────────────────────────────────────────────
export const LFO_CUTOFF_DEPTH_OCTAVES = 3;
export const LFO_PITCH_DEPTH_SEMITONES = 1;
/** Amp LFO at 100 % swings gain between 0 and 1. */
export const LFO_AMP_MAX_DEPTH = 1;

// ── Live edits ───────────────────────────────────────────────────────────
/** Time constant for smoothing knob changes on a sounding voice, in seconds. */
export const PARAM_SMOOTHING_TIME = 0.015;

// ── Noise ────────────────────────────────────────────────────────────────
export const NOISE_BUFFER_SECONDS = 2;
/** Fixed seed so noise is identical in target and attempt renders. */
export const NOISE_SEED = 0x5eed1234;

// ── Live output safety limiter (live playback only, never offline renders) ──
export const LIMITER_THRESHOLD_DB = -3;
export const LIMITER_KNEE_DB = 0;
export const LIMITER_RATIO = 20;
export const LIMITER_ATTACK = 0.002;
export const LIMITER_RELEASE = 0.1;

// ── Patch format ─────────────────────────────────────────────────────────
export const PATCH_FORMAT_VERSION = 1;

// ── UI: knobs ────────────────────────────────────────────────────────────
/** Vertical drag distance for a full sweep of a knob, in CSS pixels. */
export const KNOB_DRAG_PIXELS = 200;
/** Drag and key steps are multiplied by this while Shift is held. */
export const KNOB_FINE_FACTOR = 0.1;
/** Arrow-key step as a fraction of the full range. */
export const KNOB_KEY_STEP = 0.01;
/** Page Up / Page Down step as a fraction of the full range. */
export const KNOB_PAGE_STEP = 0.1;
/** Total sweep of the knob's arc, in degrees. */
export const KNOB_SWEEP_DEGREES = 270;
/** Two taps closer together than this reset a knob, in milliseconds. */
export const DOUBLE_TAP_MS = 300;
