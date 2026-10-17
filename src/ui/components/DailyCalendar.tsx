import { DAILY_EPOCH } from '../../engine/constants';
import type { CalendarMark } from '../../game/daily';
import { monthDates, monthOf, shiftMonth, weekday } from '../calendar';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

interface DailyCalendarProps {
  /** "YYYY-MM" shown. */
  readonly month: string;
  readonly today: string;
  readonly selected: string;
  readonly markFor: (date: string) => CalendarMark;
  readonly isAvailable: (date: string) => boolean;
  readonly onPick: (date: string) => void;
  readonly onMonth: (month: string) => void;
}

/** The daily archive: a month of days, marked by what was played. */
export function DailyCalendar({ month, today, selected, markFor, isAvailable, onPick, onMonth }: DailyCalendarProps) {
  const dates = monthDates(month);
  const first = dates[0];
  const leading = first ? weekday(first) : 0;
  const [year, monthNumber] = month.split('-').map(Number);
  const title = monthFormat.format(new Date(Date.UTC(year ?? 0, (monthNumber ?? 1) - 1, 1)));
  return (
    <section className="calendar" aria-label="Daily archive">
      <div className="calendar-head">
        <button
          type="button"
          className="button icon"
          aria-label="Previous month"
          disabled={month <= monthOf(DAILY_EPOCH)}
          onClick={() => onMonth(shiftMonth(month, -1))}
        >
          ‹
        </button>
        <span className="calendar-title">{title}</span>
        <button
          type="button"
          className="button icon"
          aria-label="Next month"
          disabled={month >= monthOf(today)}
          onClick={() => onMonth(shiftMonth(month, 1))}
        >
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS.map((day, i) => (
          <span key={i} className="calendar-weekday" aria-hidden="true">
            {day}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {dates.map((date) => {
          const mark = markFor(date);
          const classes = [
            'calendar-day',
            `mark-${mark}`,
            date === today ? 'today' : null,
            date === selected ? 'selected' : null,
          ].filter(Boolean);
          return (
            <button
              key={date}
              type="button"
              className={classes.join(' ')}
              disabled={!isAvailable(date)}
              aria-pressed={date === selected}
              aria-label={`${date}${mark === 'onTime' ? ', played' : mark === 'played' ? ', played later' : ''}`}
              onClick={() => onPick(date)}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
      <p className="calendar-key">
        <span className="calendar-dot onTime" /> played on the day · <span className="calendar-dot played" /> played later
      </p>
    </section>
  );
}
