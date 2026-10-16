import { describe, expect, it } from 'vitest';
import { PARAMS } from '../engine/params';
import { formatValue } from './format';

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
