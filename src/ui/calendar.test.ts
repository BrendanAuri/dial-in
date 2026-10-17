import { describe, expect, it } from 'vitest';
import { monthDates, monthOf, shiftMonth, weekday } from './calendar';

describe('calendar', () => {
  it('lists the days of a month, including leap years', () => {
    expect(monthDates('2026-10')).toHaveLength(31);
    expect(monthDates('2026-02')).toHaveLength(28);
    expect(monthDates('2028-02')).toHaveLength(29);
    expect(monthDates('2026-10')[0]).toBe('2026-10-01');
    expect(monthDates('nonsense')).toEqual([]);
  });

  it('numbers weekdays from Monday', () => {
    expect(weekday('2026-10-12')).toBe(0);
    expect(weekday('2026-10-17')).toBe(5);
    expect(weekday('2026-10-18')).toBe(6);
  });

  it('moves between months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
    expect(monthOf('2026-10-17')).toBe('2026-10');
  });
});
