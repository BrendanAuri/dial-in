/**
 * Every tunable number in the app lives here. Parameter ranges and defaults
 * live in the parameter schema (params.ts).
 */
import type { ContinuousParamId, LfoSync, ParamId } from './params';

// ── Pitch ────────────────────────────────────────────────────────────────
export const A4_MIDI = 69;
export const A4_HZ = 440;
/** MIDI note number of C0, so C4 (middle C) = 60. */
export const MIDI_C0 = 12;
export const SEMITONES_PER_OCTAVE = 12;
export const CENTS_PER_SEMITONE = 100;
export const CENTS_PER_OCTAVE = 1200;
export const SECONDS_PER_MINUTE = 60;

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
/** How long the "works offline" notice stays up, in ms. */
export const OFFLINE_NOTICE_MS = 4000;

// ── Rounds ───────────────────────────────────────────────────────────────
/** Time constant of the A/B crossfade when switching between target and yours, in seconds. */
export const AB_CROSSFADE_TIME = 0.008;
/** Candidates tried before the generator settles for the last one. */
export const TARGET_MAX_ATTEMPTS = 50;
/** Reject targets whose loudest moment is quieter than this, in dB. */
export const TARGET_MIN_PEAK_DB = -24;
/** A target must stay above TARGET_AUDIBLE_LEVEL (linear) for at least this long, in seconds. */
export const TARGET_MIN_AUDIBLE_SECONDS = 0.08;
export const TARGET_AUDIBLE_LEVEL = 0.1;
/**
 * At least one of the level's audible new controls must be at least this
 * scoring distance from where the knobs start (so the starting knobs
 * score at most 1 − this on it), so Submit alone can't win.
 */
export const TARGET_MIN_START_DISTANCE = 0.5;
/** Rough lowpass slope used when estimating loudness, in dB per octave. */
export const FILTER_SLOPE_DB_PER_OCTAVE = 12;
/** Time step for the loudness estimate, in seconds. */
export const LOUDNESS_STEP_SECONDS = 0.005;

// ── Scoring ──────────────────────────────────────────────────────────────
/**
 * How far off a control can be before its closeness reaches zero.
 * Log controls: octaves (a factor of 2 per octave). Linear controls:
 * a fraction of the range.
 */
export const SCORE_TOLERANCE: Readonly<Record<ContinuousParamId, number>> = {
  'osc2.detune': 0.5,
  'sub.level': 0.5,
  'noise.level': 0.5,
  'filter.cutoff': 2,
  'filter.resonance': 0.5,
  'drive.amount': 0.5,
  'fenv.amount': 0.5,
  'fenv.decay': 3,
  'amp.attack': 3,
  'amp.decay': 3,
  'amp.sustain': 0.5,
  'amp.release': 3,
  /** Also used for LFO sync: both compare the LFO's speed, in octaves. */
  'lfo.rate': 2,
  /** Never scored on its own: tempo only sets a synced LFO's speed. */
  'lfo.tempo': 0.5,
  'lfo.depth': 0.5,
};
/** Differences smaller than this (in the control's units) count as exact. */
export const SCORE_DEADBAND: Readonly<Partial<Record<ContinuousParamId, number>>> = {
  'osc2.detune': 2,
};
/** Relative weight of each control in the score. */
export const SCORE_WEIGHTS: Readonly<Record<ParamId, number>> = {
  'osc.wave': 2,
  'osc.octave': 1,
  'osc2.detune': 1,
  'sub.level': 1,
  'noise.level': 1,
  'filter.cutoff': 2,
  'filter.resonance': 1,
  'drive.amount': 1,
  'fenv.amount': 1,
  'fenv.decay': 1,
  'amp.attack': 1,
  'amp.decay': 1,
  'amp.sustain': 1,
  'amp.release': 1,
  'lfo.target': 1,
  'lfo.sync': 1,
  'lfo.rate': 1,
  'lfo.tempo': 1,
  'lfo.depth': 1,
};
/** Controls with closeness below this get a feedback tip. */
export const TIP_CLOSENESS = 0.8;
/** Tips shown on the result card (the reveal table shows all). */
export const RESULT_TIPS = 3;
/** Default pass mark; levels can set their own. */
export const PASS_MARK = 80;
/** Scores needed for one, two and three stars. */
export const STAR_SCORES = [80, 90, 97] as const;
/** Points taken off the round's score for each hint. */
export const HINT_COST = 10;
/** An attack shorter than this is described as instant, in seconds. */
export const INSTANT_ATTACK = 0.01;

// ── Audio score ──────────────────────────────────────────────────────────
export const RENDER_SAMPLE_RATE = 44100;
/** Extra silence rendered after the release, in seconds. */
export const RENDER_TAIL = 0.05;
/** Analysis frame length and step, in samples. */
export const FEATURE_BUFFER_SIZE = 2048;
export const FEATURE_HOP_SIZE = 512;
export const MFCC_COEFFICIENTS = 13;
/** Both renders are scaled to this overall RMS before comparing, so volume never biases the score. */
export const RMS_MATCH_LEVEL = 0.1;
/**
 * Frame levels are floored here, in dBFS; frames where both sides are this
 * quiet are skipped, so near-silent release tails don't dominate.
 */
export const LOUDNESS_FLOOR_DB = -45;
/** Brightness and timbre are compared only in frames where both sides are louder than this, in dBFS. */
export const SPECTRUM_GATE_DB = -45;
/** Centroids are floored here, in Hz, to keep the octave maths finite. */
export const MIN_CENTROID_HZ = 20;
/**
 * Raw distance → 0–100 for each part of the audio score: full marks up to
 * `perfect`, falling linearly to zero at `zero`. Tune with the calibration
 * page (open the app with #calibrate). First calibration, 2026-10-17: identical
 * pairs 100, slight changes mean 90, large changes mean 62 and max 91 (so no
 * large change reaches AUDIO_MATCH_SCORE).
 */
export const AUDIO_CALIBRATION = {
  loudnessDb: { perfect: 0.3, zero: 6 },
  brightnessOctaves: { perfect: 0.03, zero: 0.8 },
  timbre: { perfect: 2, zero: 45 },
  lowEndDb: { perfect: 1, zero: 12 },
} as const;
/**
 * The low-end part compares how much energy sits in each octave band
 * between these edges, in Hz, as dB of the total. MFCCs and the centroid
 * barely register a sub, so without this a missing sub could sound "the
 * same".
 */
export const LOW_END_BAND_EDGES_HZ = [20, 40, 80] as const;
/**
 * Band levels are floored here, in dB of the total; a band both sounds have
 * below this is left out. About where a sub stops being noticeable under
 * the rest of the sound.
 */
export const LOW_END_FLOOR_DB = -24;
/** FFT size for the low-end bands: long enough to resolve 20–80 Hz. Frames step by half of it. */
export const LOW_END_FFT_SIZE = 8192;
/** Share of the final score that comes from the audio score. */
export const AUDIO_SCORE_WEIGHT = 0.3;
/** An audio score at or above this lifts the final score to at least AUDIO_MATCH_FLOOR. */
export const AUDIO_MATCH_SCORE = 95;
export const AUDIO_MATCH_FLOOR = 90;

// ── Spectrum views ───────────────────────────────────────────────────────
/** Live analyser: FFT size, smoothing between frames, and the dB range it reports. */
export const ANALYSER_FFT_SIZE = 4096;
export const ANALYSER_SMOOTHING = 0.75;
export const ANALYSER_MIN_DB = -100;
export const ANALYSER_MAX_DB = -20;
/** Frequency range drawn, in Hz. */
export const SPECTRUM_MIN_HZ = 20;
export const SPECTRUM_MAX_HZ = 16000;
/** Log-spaced bands in the result overlay. */
export const OVERLAY_BANDS = 96;
/** Vertical range of the result overlay, below its loudest band, in dB. */
export const OVERLAY_RANGE_DB = 60;
/** Space above the loudest band in the overlay, in dB. */
export const OVERLAY_HEADROOM_DB = 4;

// ── Audibility (what can't be heard in the target isn't scored) ──────────
/** Resonance can't be heard with the cutoff at or above this, in Hz. */
export const RESONANCE_AUDIBLE_MAX_CUTOFF = 12000;
/** Filter envelope movement below this many octaves doesn't count. */
export const FILTER_ENV_MIN_AUDIBLE_OCTAVES = 0.05;
/** LFO depth below this counts as no LFO. */
export const LFO_MIN_AUDIBLE_DEPTH = 0.02;
/** Sustain at or above this counts as full, so decay can't be heard. */
export const SUSTAIN_FULL = 0.99;
/** If the envelope has fallen below this by the end of the hold, release can't be heard. */
export const RELEASE_MIN_AUDIBLE_LEVEL = 0.01;
/**
 * Waveform can't be heard when the cutoff never rises above the note's
 * fundamental times this (only the fundamental gets through).
 */
export const WAVEFORM_MIN_CUTOFF_RATIO = 1;
/** A sub oscillator below this can't be heard, in Hz. */
export const SUB_MIN_AUDIBLE_HZ = 25;

// ── Levels and progress ──────────────────────────────────────────────────
/** Rounds in a level run, unless the level sets its own. */
export const DEFAULT_ROUNDS = 5;
export const PROGRESS_SCHEMA_VERSION = 1;
/** How many weakest controls Home lists. */
export const WEAKEST_CONTROLS_SHOWN = 3;
/** Rounds a control must have been scored in before it can be listed as weak. */
export const WEAKEST_MIN_ROUNDS = 3;

// ── Daily challenge ──────────────────────────────────────────────────────
/** Daily #1 falls on this local date; the archive starts here. */
export const DAILY_EPOCH = '2026-10-01';
/** Submits per daily tier; the best one counts. */
export const DAILY_SUBMITS = 3;
/** Scoring at least this ends a daily early and shows the answer. */
export const DAILY_FINISH_SCORE = 97;

// ── Sharing and keeping ──────────────────────────────────────────────────
/** Format version at the start of every share code. Adding controls doesn't need a new one. */
export const SHARE_CODE_VERSION = 1;
/** Continuous values are stored as their knob position, in this many steps (16 bits). */
export const SHARE_VALUE_STEPS = 0xffff;
/** Characters of check value at the end of a share code, to catch links that were cut short or mistyped. */
export const SHARE_CHECK_CHARS = 2;
/** Scoring at least this on a round offers to keep the target as a sound. */
export const KEEP_MIN_SCORE = 90;
/** Notes a challenge can be played on, lowest first. */
export const CHALLENGE_NOTES = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;
export const DEFAULT_CHALLENGE_NOTE = 'C3';

// ── Sound library ────────────────────────────────────────────────────────
export const LIBRARY_SCHEMA_VERSION = 1;
export const SESSION_SCHEMA_VERSION = 1;
export const SOUND_NAME_MAX_LENGTH = 60;
export const SOUND_TAG_MAX_LENGTH = 24;
export const SOUND_MAX_TAGS = 8;
/** Suggest a backup export after this many saves since the last one. */
export const BACKUP_NUDGE_SAVES = 10;

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
/** Gain of the sub oscillator when Sub is at 100 %. */
export const SUB_MAX_GAIN = 0.6;
/** The sub oscillator plays this many octaves below osc 1. */
export const SUB_OCTAVES_BELOW = 1;
/** Resonance 0–1 maps linearly to lowpass Q of 0 dB up to this. */
export const RESONANCE_MAX_DB = 18;
/** Output gain of a single voice. */
export const VOICE_GAIN = 0.5;
/** Fixed gain of the master bus. */
export const MASTER_GAIN = 0.6;

// ── Drive ────────────────────────────────────────────────────────────────
/**
 * Drive pushes the signal into a tanh soft clipper with a gain of
 * DRIVE_MAX_GAIN^amount − 1 (0 at no drive, 31 at full), normalised so a
 * full-scale input still peaks at 1.
 */
export const DRIVE_MAX_GAIN = 32;
/** The drive curve covers inputs up to this level, so resonant peaks aren't hard-clipped. A power of two, so scaling in and out is exact. */
export const DRIVE_HEADROOM = 4;
/** Points in the drive curve. Odd, so silence maps exactly to the middle point. */
export const DRIVE_CURVE_SIZE = 4097;
/** Oversampling for the drive stage, to keep its new harmonics from aliasing. */
export const DRIVE_OVERSAMPLE: OverSampleType = '4x';

// ── LFO sync ─────────────────────────────────────────────────────────────
/** LFO cycles per beat for each synced note length: a 1/4 note is one beat, so 1/4 is one cycle per beat. */
export const LFO_SYNC_CYCLES_PER_BEAT: Readonly<Record<Exclude<LfoSync, 'off'>, number>> = {
  '1/2': 0.5,
  '1/4': 1,
  '1/4T': 1.5,
  '1/8': 2,
  '1/8T': 3,
  '1/16': 4,
  '1/16T': 6,
};

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
/** Selectors with more options than this wrap into rows of SELECTOR_ROW_OPTIONS. */
export const SELECTOR_MAX_ONE_ROW = 5;
export const SELECTOR_ROW_OPTIONS = 4;
