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
/** How long a round's note is held before release, in seconds. */
export const DEFAULT_HOLD_TIME = 1.5;
export const DEFAULT_NOTE = 'C3';
/** Lowest and highest notes offered by the test page's note picker. */
export const NOTE_PICKER_RANGE = ['C1', 'C6'] as const;
/** Live notes are scheduled this far ahead of currentTime, in seconds. */
export const LIVE_START_DELAY = 0.01;

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
