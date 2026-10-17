import { describe, expect, it } from 'vitest';
import { DAILY_EPOCH } from '../engine/constants';
import {
  addDays,
  calendarMark,
  dailyKey,
  dailyNumber,
  dailySeed,
  dailyTiers,
  dayIndex,
  isDailyDate,
  isTierAvailable,
  localDate,
  saveDaily,
  shareText,
  streaks,
  type DailyTierRef,
} from './daily';
import { FIXTURE_PACK, SEQUEL_PACK } from './fixtures';
import { EMPTY_PROGRESS, finishRun, startRun, type Progress } from './progress';
import { findLevel } from './packs';

const [easy, hard] = dailyTiers([FIXTURE_PACK, SEQUEL_PACK]) as [DailyTierRef, DailyTierRef];

function played(progress: Progress, date: string, onTime = true, ref: DailyTierRef = easy): Progress {
  return saveDaily(progress, dailyKey(date, ref), { best: 80, submits: 1, finished: false }, onTime);
}

describe('dates', () => {
  it('formats the local calendar date', () => {
    expect(localDate(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(localDate(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
  });

  it('rejects dates that do not exist', () => {
    expect(dayIndex('2026-02-31')).toBeNull();
    expect(dayIndex('2026-13-01')).toBeNull();
    expect(dayIndex('yesterday')).toBeNull();
    expect(dayIndex('2028-02-29')).not.toBeNull();
  });

  it('adds days across months, years and clock changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('numbers dailies from the epoch', () => {
    expect(dailyNumber(DAILY_EPOCH)).toBe(1);
    expect(dailyNumber(addDays(DAILY_EPOCH, 141))).toBe(142);
  });

  it('only has dailies from the epoch up to today', () => {
    expect(isDailyDate('2026-10-17', '2026-10-17')).toBe(true);
    expect(isDailyDate(DAILY_EPOCH, '2026-10-17')).toBe(true);
    expect(isDailyDate('2026-10-18', '2026-10-17')).toBe(false);
    expect(isDailyDate(addDays(DAILY_EPOCH, -1), '2026-10-17')).toBe(false);
    expect(isDailyDate('nope', '2026-10-17')).toBe(false);
  });
});

describe('tiers and seeds', () => {
  it('lists tiers from pack data', () => {
    expect([easy.tier.id, easy.level.id, hard.tier.id, hard.level.id]).toEqual(['easy', 'wave', 'hard', 'lfo']);
  });

  it('skips tiers whose level does not exist', () => {
    const broken = { ...FIXTURE_PACK, daily: [{ id: 'x', title: 'X', levelId: 'missing' }] };
    expect(dailyTiers([broken])).toEqual([]);
  });

  it('opens a tier once its level is passed', () => {
    const level = findLevel(FIXTURE_PACK, 'wave');
    if (!level) throw new Error('fixture');
    const ref = { pack: FIXTURE_PACK, level };
    expect(isTierAvailable(EMPTY_PROGRESS, easy)).toBe(false);
    const passed = finishRun(startRun(EMPTY_PROGRESS, ref, 1), ref, [90, 90, 90, 90, 90]);
    expect(isTierAvailable(passed, easy)).toBe(true);
    expect(isTierAvailable(passed, hard)).toBe(false);
  });

  it('gives everyone the same seed for a date and tier, and different ones otherwise', () => {
    expect(dailySeed('2026-10-17', easy)).toBe(dailySeed('2026-10-17', easy));
    expect(dailySeed('2026-10-17', easy)).not.toBe(dailySeed('2026-10-18', easy));
    expect(dailySeed('2026-10-17', easy)).not.toBe(dailySeed('2026-10-17', hard));
  });
});

describe('saving', () => {
  it('keeps the best score and most submits, and finished stays finished', () => {
    const key = dailyKey('2026-10-17', easy);
    let p = saveDaily(EMPTY_PROGRESS, key, { best: 70, submits: 1, finished: false }, true);
    p = saveDaily(p, key, { best: 60, submits: 2, finished: false }, true);
    p = saveDaily(p, key, { best: 85, submits: 3, finished: true }, true);
    p = saveDaily(p, key, { best: 10, submits: 1, finished: false }, true);
    expect(p.dailies[key]).toEqual({ best: 85, submits: 3, finished: true, onTime: true });
  });

  it('decides on time once, when first saved', () => {
    const key = dailyKey('2026-10-17', easy);
    const p = saveDaily(saveDaily(EMPTY_PROGRESS, key, { best: 50, submits: 1, finished: false }, true), key, { best: 60, submits: 2, finished: false }, false);
    expect(p.dailies[key]?.onTime).toBe(true);
    const late = saveDaily(EMPTY_PROGRESS, key, { best: 50, submits: 1, finished: false }, false);
    expect(late.dailies[key]?.onTime).toBe(false);
  });
});

describe('streaks', () => {
  it('counts consecutive days up to today', () => {
    let p = played(EMPTY_PROGRESS, '2026-10-15');
    p = played(p, '2026-10-16');
    p = played(p, '2026-10-17');
    expect(streaks(p, '2026-10-17')).toEqual({ current: 3, best: 3, playedToday: true });
  });

  it("stays alive until today is over, if yesterday was played", () => {
    const p = played(played(EMPTY_PROGRESS, '2026-10-15'), '2026-10-16');
    expect(streaks(p, '2026-10-17')).toEqual({ current: 2, best: 2, playedToday: false });
    expect(streaks(p, '2026-10-18').current).toBe(0);
  });

  it('remembers the best run across gaps, months and years', () => {
    let p = EMPTY_PROGRESS;
    for (const date of ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']) p = played(p, date);
    p = played(p, '2027-01-05');
    expect(streaks(p, '2027-01-05')).toEqual({ current: 1, best: 4, playedToday: true });
  });

  it('ignores archive plays and counts several tiers on one day once', () => {
    let p = played(EMPTY_PROGRESS, '2026-10-16', false);
    p = played(p, '2026-10-17');
    p = played(p, '2026-10-17', true, hard);
    expect(streaks(p, '2026-10-17')).toEqual({ current: 1, best: 1, playedToday: true });
  });
});

describe('sharing and the archive', () => {
  it('shares a spoiler-free line', () => {
    expect(shareText(addDays(DAILY_EPOCH, 141), 'Full', { best: 94, submits: 2 }, 3)).toBe('Dial In daily #142 · Full · 94 ★★ · 2/3');
    expect(shareText(DAILY_EPOCH, 'Basics', { best: 61, submits: 3 }, 3)).toBe('Dial In daily #1 · Basics · 61 · 3/3');
  });

  it('marks calendar days by how they were played', () => {
    let p = played(EMPTY_PROGRESS, '2026-10-15', false);
    p = played(p, '2026-10-16');
    expect(calendarMark(p, '2026-10-15')).toBe('played');
    expect(calendarMark(p, '2026-10-16')).toBe('onTime');
    expect(calendarMark(p, '2026-10-17')).toBe('none');
  });
});
