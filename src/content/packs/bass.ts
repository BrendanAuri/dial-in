/**
 * Bass Music: the first expansion pack. Needs Foundations, and adds the
 * sub oscillator, drive and tempo-synced LFO. Notes sit low (C1–C3), so
 * it's a headphones pack.
 */
import { BASS_TYPES, STAB, WOBBLE, WOBBLE_TYPES } from '../bassTypes';
import type { Pack } from '../schema';

/** Every level plays at this tempo; the LFO's Tempo stays fixed so synced wobbles have a beat to follow. */
const FIXED = { 'lfo.tempo': 140 } as const;

const OFF = { kind: 'range', min: 0, max: 0 } as const;
const SAW_OR_SQUARE = { kind: 'choice', options: ['saw', 'square'], weights: [3, 1] } as const;
const OCTAVE_0 = { kind: 'choice', options: [0] } as const;
const OCTAVE_UP_SOMETIMES = { kind: 'choice', options: [0, 1], weights: [3, 1] } as const;
const SUB_SOMETIMES = { kind: 'range', min: 0.3, max: 0.8, offChance: 0.5 } as const;

export const BASS_PACK: Pack = {
  id: 'bass',
  title: 'Bass Music',
  description: 'Subs, reeses, wobbles and growls: the low end of electronic music. Bring headphones.',
  version: 1,
  requires: { packs: ['foundations'], engineModules: ['sub', 'drive'] },
  baseControls: ['osc.wave', 'osc.octave', 'filter.cutoff', 'filter.resonance'],
  daily: [
    { id: 'low-end', title: 'Low end', levelId: 'reese' },
    { id: 'bass-mode', title: 'Bass mode', levelId: 'bass-mode' },
  ],
  chapters: [
    {
      id: 'low-end',
      title: 'Low end',
      description: 'Weight and grit.',
      levels: [
        {
          id: 'sub',
          title: 'Sub',
          intro:
            "The sub oscillator adds a clean sine an octave below. It joins after the filter, so it stays solid however you shape the rest. You feel it more than hear it: use headphones, since phone and laptop speakers can't play it.",
          newControls: ['sub.level'],
          fixed: FIXED,
          generator: {
            params: {
              'osc.wave': { kind: 'choice', options: ['saw', 'square', 'triangle', 'sine'], weights: [3, 2, 1, 1] },
              'osc.octave': OCTAVE_UP_SOMETIMES,
              'filter.cutoff': { kind: 'range', min: 150, max: 2500 },
              'filter.resonance': { kind: 'range', min: 0, max: 0.4 },
              'sub.level': { kind: 'range', min: 0.3, max: 1 },
            },
          },
          noteRange: ['C2', 'C3'],
        },
        {
          id: 'drive',
          title: 'Drive',
          intro:
            'Drive pushes the sound into distortion, adding harmonics: a sine turns gritty and a saw snarls. It comes after the filter, so it adds brightness back above the cutoff, which helps low notes cut through.',
          newControls: ['drive.amount'],
          fixed: FIXED,
          generator: {
            params: {
              'osc.wave': { kind: 'choice', options: ['sine', 'triangle', 'saw', 'square'] },
              'osc.octave': OCTAVE_UP_SOMETIMES,
              'filter.cutoff': { kind: 'range', min: 80, max: 1500 },
              'filter.resonance': { kind: 'range', min: 0, max: 0.5 },
              'sub.level': SUB_SOMETIMES,
              'drive.amount': { kind: 'range', min: 0.25, max: 1 },
            },
          },
          noteRange: ['C1', 'C3'],
        },
      ],
    },
    {
      id: 'reese',
      title: 'Reese',
      description: 'Detuned saws: the sound of drum & bass.',
      levels: [
        {
          id: 'reese',
          title: 'Reese',
          intro:
            'A reese is two saws slightly detuned, drifting in and out of phase. That slow, rolling movement is the heart of drum & bass and dubstep basses. More detune rolls faster; drive makes it growl.',
          newControls: ['osc2.detune'],
          fixed: FIXED,
          generator: {
            params: {
              'osc.wave': SAW_OR_SQUARE,
              'osc.octave': OCTAVE_UP_SOMETIMES,
              'osc2.detune': { kind: 'range', min: 10, max: 40 },
              'sub.level': SUB_SOMETIMES,
              'filter.cutoff': { kind: 'range', min: 200, max: 2500 },
              'filter.resonance': { kind: 'range', min: 0, max: 0.4 },
              'drive.amount': { kind: 'range', min: 0.15, max: 0.7, offChance: 0.4 },
            },
          },
          noteRange: ['C1', 'C2'],
        },
      ],
    },
    {
      id: 'wobble',
      title: 'Wobble',
      description: 'The LFO on the filter, locked to the beat.',
      levels: [
        {
          id: 'tempo-sync',
          title: 'Tempo sync',
          intro:
            'A wobble is the LFO moving the cutoff in time with the track. Sync sets its speed as a note length at the tempo (140 BPM here): 1/4 moves once a beat, 1/8 twice, 1/16 four times. T is a triplet: three in the time of two.',
          newControls: ['lfo.target', 'lfo.sync', 'lfo.depth'],
          fixed: FIXED,
          generator: {
            params: {
              'osc.wave': SAW_OR_SQUARE,
              'osc.octave': OCTAVE_0,
              'osc2.detune': OFF,
              'sub.level': OFF,
              'filter.cutoff': { kind: 'range', min: 100, max: 500 },
              'filter.resonance': { kind: 'range', min: 0.2, max: 0.7 },
              'drive.amount': { kind: 'range', min: 0.2, max: 0.5, offChance: 0.6 },
              'lfo.target': { kind: 'choice', options: ['cutoff'] },
              'lfo.sync': {
                kind: 'choice',
                options: ['1/2', '1/4', '1/4T', '1/8', '1/8T', '1/16'],
                weights: [1, 3, 1, 3, 2, 2],
              },
              'lfo.depth': { kind: 'range', min: 0.3, max: 0.8 },
            },
          },
          noteRange: ['C1', 'C2'],
        },
        {
          id: 'wobble-bass',
          title: 'Wobble bass',
          intro:
            'The wobble meets everything else: reese detune underneath, drive on top. Listen for the speed first, then the grit.',
          newControls: [],
          fixed: FIXED,
          generator: { params: WOBBLE, templates: WOBBLE_TYPES },
          noteRange: ['C1', 'C2'],
        },
      ],
    },
    {
      id: 'stabs',
      title: 'Stabs and plucks',
      description: 'Short basses that bounce.',
      levels: [
        {
          id: 'stabs',
          title: 'Stabs and plucks',
          intro:
            'Short basses live on their envelopes: an instant attack, a quick decay to a low sustain, and a filter envelope that snaps the cutoff open on every note. Drive makes them punch harder.',
          newControls: ['fenv.amount', 'fenv.decay', 'amp.attack', 'amp.decay', 'amp.sustain', 'amp.release'],
          fixed: FIXED,
          generator: { params: STAB },
          noteRange: ['C2', 'C3'],
        },
      ],
    },
    {
      id: 'bass-mode',
      title: 'Bass mode',
      description: 'Everything together, as real bass sounds.',
      levels: [
        {
          id: 'bass-mode',
          title: 'Bass mode',
          intro:
            'Everything together: subs, reeses, wobbles, growls and stabs. Work out which kind of bass it is first, then dial in the details.',
          newControls: [],
          fixed: FIXED,
          generator: { params: STAB, templates: BASS_TYPES },
          noteRange: ['C1', 'C3'],
        },
      ],
    },
  ],
  presets: [
    {
      id: 'clean-sub',
      name: 'Clean sub',
      tags: ['bass', 'sub'],
      patch: { 'osc.wave': 'sine', 'osc.octave': -1, 'sub.level': 0.6, 'amp.release': 0.15 },
    },
    {
      id: 'warm-sub',
      name: 'Warm sub',
      tags: ['bass', 'sub'],
      patch: { 'osc.wave': 'triangle', 'osc.octave': -1, 'filter.cutoff': 400, 'sub.level': 0.8, 'drive.amount': 0.25, 'amp.release': 0.15 },
    },
    {
      id: 'driven-sine',
      name: 'Driven sine',
      tags: ['bass', 'sub', 'drive'],
      patch: { 'osc.wave': 'sine', 'osc.octave': -1, 'sub.level': 0.5, 'drive.amount': 0.7 },
    },
    {
      id: 'reese',
      name: 'Reese',
      tags: ['bass', 'reese'],
      patch: {
        'osc.wave': 'saw',
        'osc.octave': -1,
        'osc2.detune': 22,
        'filter.cutoff': 900,
        'filter.resonance': 0.2,
        'drive.amount': 0.3,
        'amp.release': 0.2,
      },
    },
    {
      id: 'dark-reese',
      name: 'Dark reese 174',
      tags: ['bass', 'reese', 'wobble'],
      patch: {
        'osc.wave': 'saw',
        'osc.octave': -1,
        'osc2.detune': 32,
        'filter.cutoff': 350,
        'filter.resonance': 0.35,
        'drive.amount': 0.55,
        'lfo.target': 'cutoff',
        'lfo.sync': '1/2',
        'lfo.tempo': 174,
        'lfo.depth': 0.15,
        'amp.release': 0.2,
      },
    },
    {
      id: 'wobble',
      name: 'Wobble 1/4',
      tags: ['bass', 'wobble'],
      patch: {
        'osc.wave': 'saw',
        'osc.octave': -1,
        'filter.cutoff': 180,
        'filter.resonance': 0.55,
        'drive.amount': 0.35,
        'lfo.target': 'cutoff',
        'lfo.sync': '1/4',
        'lfo.tempo': 140,
        'lfo.depth': 0.65,
      },
    },
    {
      id: 'triplet-growl',
      name: 'Triplet growl',
      tags: ['bass', 'wobble', 'growl'],
      patch: {
        'osc.wave': 'square',
        'osc.octave': -1,
        'osc2.detune': 10,
        'filter.cutoff': 250,
        'filter.resonance': 0.7,
        'drive.amount': 0.85,
        'lfo.target': 'cutoff',
        'lfo.sync': '1/8T',
        'lfo.tempo': 140,
        'lfo.depth': 0.5,
      },
    },
    {
      id: 'bass-stab',
      name: 'Bass stab',
      tags: ['bass', 'stab'],
      patch: {
        'osc.wave': 'saw',
        'osc.octave': -1,
        'sub.level': 0.5,
        'filter.cutoff': 150,
        'filter.resonance': 0.4,
        'drive.amount': 0.45,
        'fenv.amount': 3.5,
        'fenv.decay': 0.18,
        'amp.attack': 0.001,
        'amp.decay': 0.3,
        'amp.sustain': 0.15,
        'amp.release': 0.12,
      },
    },
    {
      id: 'gated-sub',
      name: 'Gated sub 1/16',
      tags: ['bass', 'sub', 'gate'],
      patch: {
        'osc.wave': 'triangle',
        'osc.octave': -1,
        'filter.cutoff': 600,
        'sub.level': 0.7,
        'lfo.target': 'amp',
        'lfo.sync': '1/16',
        'lfo.tempo': 140,
        'lfo.depth': 0.9,
      },
    },
  ],
};
