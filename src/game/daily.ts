/**
 * The daily challenge: one shared target per tier per day, with no backend.
 * Seeds come from the player's local date, so everyone gets the same
 * target on the same day and it rolls over at local midnight.
 */
import type { DailyTier, Level, Pack } from '../content/schema';
import { DAILY_EPOCH } from '../engine/constants';
import { starsFor } from '../scoring/finalScore';
import { findLevel } from './packs';
import { isLevelPassed, isPackSupported, type DailyRecord, type Progress } from './progress';
import { hashString } from './rng';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

// ── Dates ────────────────────────────────────────────────────────────────

const pad = (n: number): string => String(n).padStart(2, '0');

/** The local calendar date of `date`, as "YYYY-MM-DD". */
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Days since 1970-01-01 for a "YYYY-MM-DD" date, or null if it isn't a real date. */
export function dayIndex(date: string): number | null {
  const match = DATE_PATTERN.exec(date);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (y === undefined || m === undefined || d === undefined) return null;
  const ms = Date.UTC(y, m - 1, d);
  // Reject dates like 2026-02-31 that Date.UTC silently rolls over.
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return Math.round(ms / MS_PER_DAY);
}

/** The "YYYY-MM-DD" date `days` after `date` (negative for before). */
export function addDays(date: string, days: number): string {
  const index = dayIndex(date);
  if (index === null) return date;
  const shifted = new Date((index + days) * MS_PER_DAY);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Daily #1 is DAILY_EPOCH. Null for dates that aren't valid. */
export function dailyNumber(date: string): number | null {
  const index = dayIndex(date);
  const epoch = dayIndex(DAILY_EPOCH);
  return index === null || epoch === null ? null : index - epoch + 1;
}

/** A daily exists for this date: valid, on or after the epoch, and not after today. */
export function isDailyDate(date: string, today: string): boolean {
  const number = dailyNumber(date);
  const todayIndex = dayIndex(today);
  const index = dayIndex(date);
  return number !== null && number >= 1 && index !== null && todayIndex !== null && index <= todayIndex;
}

// ── Tiers ────────────────────────────────────────────────────────────────

export interface DailyTierRef {
  readonly pack: Pack;
  readonly tier: DailyTier;
  readonly level: Level;
}

/** Every daily tier from supported packs, in pack order. */
export function dailyTiers(packs: readonly Pack[]): DailyTierRef[] {
  return packs.filter(isPackSupported).flatMap((pack) =>
    (pack.daily ?? []).flatMap((tier) => {
      const level = findLevel(pack, tier.levelId);
      return level ? [{ pack, tier, level }] : [];
    }),
  );
}

/** A tier is open once its level has been passed. */
export function isTierAvailable(progress: Progress, ref: DailyTierRef): boolean {
  return isLevelPassed(progress, ref.pack, ref.level.id);
}

export function dailyKey(date: string, ref: DailyTierRef): string {
  return `${date}/${ref.pack.id}/${ref.tier.id}`;
}

/** The same for every player: derived only from the date, pack and tier. */
export function dailySeed(date: string, ref: DailyTierRef): number {
  return hashString(dailyKey(date, ref));
}

// ── Results ──────────────────────────────────────────────────────────────

export interface DailyAttempts {
  readonly best: number;
  readonly submits: number;
  readonly finished: boolean;
}

/**
 * Save a daily's attempts. Whether it counts towards streaks is fixed when
 * it's first saved: on time only if first played on its own date.
 */
export function saveDaily(progress: Progress, key: string, attempts: DailyAttempts, playedOnItsDate: boolean): Progress {
  const previous = progress.dailies[key];
  const record: DailyRecord = {
    best: Math.max(previous?.best ?? 0, attempts.best),
    submits: Math.max(previous?.submits ?? 0, attempts.submits),
    finished: (previous?.finished ?? false) || attempts.finished,
    onTime: previous?.onTime ?? playedOnItsDate,
  };
  return { ...progress, dailies: { ...progress.dailies, [key]: record } };
}

export function dateOfKey(key: string): string {
  return key.slice(0, key.indexOf('/'));
}

/** Dates with at least one daily submitted on its own date. */
export function streakDates(progress: Progress): Set<string> {
  const dates = new Set<string>();
  for (const [key, record] of Object.entries(progress.dailies)) {
    if (record.onTime && record.submits > 0) dates.add(dateOfKey(key));
  }
  return dates;
}

export interface Streaks {
  /** Consecutive days up to today (or up to yesterday, if today isn't played yet). */
  readonly current: number;
  readonly best: number;
  readonly playedToday: boolean;
}

export function streaks(progress: Progress, today: string): Streaks {
  const dates = streakDates(progress);
  const playedToday = dates.has(today);
  let current = 0;
  for (let day = playedToday ? today : addDays(today, -1); dates.has(day); day = addDays(day, -1)) current++;

  const indices = [...dates].map(dayIndex).filter((i): i is number => i !== null).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  indices.forEach((index, i) => {
    run = i > 0 && index === (indices[i - 1] ?? NaN) + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return { current, best: Math.max(best, current), playedToday };
}

/** Spoiler-free result to share: no settings, just the score, e.g. "Dial In daily #142 · Full · 94 ★★ · 2/3". */
export function shareText(date: string, tierTitle: string, attempts: Pick<DailyRecord, 'best' | 'submits'>, maxSubmits: number): string {
  const stars = starsFor(attempts.best);
  const score = stars > 0 ? `${attempts.best} ${'★'.repeat(stars)}` : `${attempts.best}`;
  return `Dial In daily #${dailyNumber(date) ?? '?'} · ${tierTitle} · ${score} · ${attempts.submits}/${maxSubmits}`;
}

/** How a date looks in the archive calendar. */
export type CalendarMark = 'none' | 'played' | 'onTime';

export function calendarMark(progress: Progress, date: string): CalendarMark {
  let mark: CalendarMark = 'none';
  for (const [key, record] of Object.entries(progress.dailies)) {
    if (dateOfKey(key) !== date || record.submits === 0) continue;
    if (record.onTime) return 'onTime';
    mark = 'played';
  }
  return mark;
}
