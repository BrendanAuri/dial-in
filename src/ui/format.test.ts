import { describe, expect, it } from 'vitest';
import { controlName, PARAMS } from '../engine/params';
import { DEFAULT_PATCH } from '../engine/patch';
import { formatParam, formatValue } from './format';

describe('formatParam and controlName', () => {
  it('formats choices by label and numbers with units', () => {
    expect(formatParam('osc.wave', DEFAULT_PATCH)).toBe('Saw');
    expect(formatParam('osc.octave', { ...DEFAULT_PATCH, 'osc.octave': -1 })).toBe('−1');
    expect(formatParam('lfo.target', DEFAULT_PATCH)).toBe('Off');
    expect(formatParam('filter.cutoff', DEFAULT_PATCH)).toBe('18.0 kHz');
  });

  it('adds the module only where the label alone is unclear', () => {
    expect(controlName('filter.cutoff')).toBe('Cutoff');
    expect(controlName('amp.attack')).toBe('Attack');
    expect(controlName('amp.decay')).toBe('Amp envelope decay');
    expect(controlName('fenv.decay')).toBe('Filter envelope decay');
    expect(controlName('fenv.amount')).toBe('Filter envelope amount');
    expect(controlName('lfo.rate')).toBe('LFO rate');
    expect(controlName('lfo.target')).toBe('LFO target');
  });
});

describe('formatValue', () => {
  it('formats frequencies in Hz and kHz', () => {
    expect(formatValue(PARAMS['filter.cutoff'], 40)).toBe('40.0 Hz');
    expect(formatValue(PARAMS['filter.cutoff'], 850)).toBe('850 Hz');
    expect(formatValue(PARAMS['filter.cutoff'], 1250)).toBe('1.25 kHz');
    expect(formatValue(PARAMS['filter.cutoff'], 18000)).toBe('18.0 kHz');
    expect(formatValue(PARAMS['lfo.rate'], 2)).toBe('2.00 Hz');
  });

  it('formats times in ms below a second', () => {
    expect(formatValue(PARAMS['amp.attack'], 0.005)).toBe('5.00 ms');
    expect(formatValue(PARAMS['amp.attack'], 0.3)).toBe('300 ms');
    expect(formatValue(PARAMS['amp.release'], 1.5)).toBe('1.50 s');
  });

  it('formats percentages, cents and octaves', () => {
    expect(formatValue(PARAMS['amp.sustain'], 0.555)).toBe('56 %');
    expect(formatValue(PARAMS['osc2.detune'], 12.34)).toBe('12.3 cents');
    expect(formatValue(PARAMS['fenv.amount'], 2.5)).toBe('2.50 oct');
  });
});
