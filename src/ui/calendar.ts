/** Month maths for the daily archive calendar. Months are "YYYY-MM"; dates "YYYY-MM-DD". */

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

const pad = (n: number): string => String(n).padStart(2, '0');

function parseMonth(month: string): { year: number; month: number } | null {
  const match = MONTH_PATTERN.exec(month);
  const year = Number(match?.[1]);
  const value = Number(match?.[2]);
  return match && value >= 1 && value <= MONTHS_PER_YEAR ? { year, month: value } : null;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Every date in the month, in order. */
export function monthDates(month: string): string[] {
  const parsed = parseMonth(month);
  if (!parsed) return [];
  const days = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** 0 for Monday … 6 for Sunday. */
export function weekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const sundayFirst = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return (sundayFirst + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
}

export function shiftMonth(month: string, by: number): string {
  const parsed = parseMonth(month);
  if (!parsed) return month;
  const index = parsed.year * MONTHS_PER_YEAR + (parsed.month - 1) + by;
  return `${Math.floor(index / MONTHS_PER_YEAR)}-${pad((index % MONTHS_PER_YEAR) + 1)}`;
}
