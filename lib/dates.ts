import type { RepeatCadence } from '@prisma/client';

export const UPCOMING_WINDOW_DAYS = 7;

// The worship team runs on Eastern time (see lib/prayer-call.ts, lib/bible.ts).
// An event's stored `date` is the intended *Eastern* calendar day anchored to
// UTC midnight (a Sunday service = "...T00:00:00.000Z" on that Sunday).
export const APP_TIME_ZONE = 'America/New_York';

// Event dates represent a calendar day with no time-of-day meaning (the
// time-of-day lives in the separate `time` string). To stay consistent between
// the local dev server and Vercel's UTC server — and between server and browser
// — every calendar-date value is anchored to UTC midnight and read with UTC
// getters. Mixing local and UTC is what made a Sunday render as Saturday.

/**
 * Start of "today" — the current *Eastern* calendar day, anchored to UTC
 * midnight to match how event dates are stored.
 *
 * Must NOT use the raw UTC calendar day: on a Friday evening in Eastern the
 * clock in UTC has already rolled to Saturday, so a UTC "today" made the Sunday
 * service read "in 1 day" while it was still Friday for the team (and "Today" on
 * Saturday night). Deriving the day in America/New_York keeps the countdown on
 * the team's wall clock regardless of where this runs (Vercel is UTC).
 */
export function startOfToday(): Date {
  // en-CA formats as "YYYY-MM-DD"; take the Eastern calendar day for right now.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * End of the upcoming window, in UTC: a span of exactly UPCOMING_WINDOW_DAYS
 * calendar days (today + the next 6). Using a full 7-day span — rather than 8 —
 * means a weekly recurring event lands in the window only once.
 */
export function upcomingWindowEnd(from: Date = startOfToday()): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + UPCOMING_WINDOW_DAYS - 1);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Is the given date within the next-7-days upcoming window? */
export function isWithinUpcomingWindow(date: Date): boolean {
  const now = startOfToday();
  return date >= now && date <= upcomingWindowEnd(now);
}

/**
 * Whole calendar days from today until the given event date, in UTC. 0 = today,
 * 1 = tomorrow. Used for the "Up next" countdown. Both sides are anchored to UTC
 * midnight so the count never drifts by the local/UTC offset.
 */
export function daysUntil(date: Date): number {
  const today = startOfToday();
  const d = new Date(date);
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((target - today.getTime()) / 86_400_000);
}

/**
 * How far ahead a recurring series stays materialized: a rolling 4-calendar-week
 * (28-day) horizon. The number of occurrences "up" follows from the cadence —
 * weekly → 4, biweekly → 2, monthly → 1 — and the window rolls forward over time
 * (see ensureRecurringWindow).
 */
export const SERIES_HORIZON_DAYS = 28;

/** Exclusive end of the rolling window measured from `from` (start + 28 days). */
export function seriesHorizonEnd(from: Date): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + SERIES_HORIZON_DAYS);
  return d;
}

/**
 * The UTC-midnight date `months` months after `date`, on `dayOfMonth` — clamped
 * to the last day of the target month when it's shorter. So a series meant for
 * the 31st runs Jan 31 → Feb 28 (29 in a leap year) → Mar 31 → Apr 30, never
 * overflowing into the next month (raw setUTCMonth turned Jan 31 into Mar 3).
 */
export function addMonthsClamped(date: Date, months: number, dayOfMonth: number = date.getUTCDate()): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  // Day 0 of the following month = last day of the target month.
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dayOfMonth, lastDay)));
}

/**
 * Advance a date in place by one cadence step (UTC). No-op for `once`.
 * `monthlyDay` is the series' intended day of month (defaults to the date's own
 * day); pass it so a month-end series that was clamped (e.g. to Feb 28) snaps
 * back to the 31st instead of drifting to the 28th forever.
 */
export function stepDate(d: Date, repeats: RepeatCadence, monthlyDay?: number): void {
  switch (repeats) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'biweekly':
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case 'monthly':
      d.setTime(addMonthsClamped(d, 1, monthlyDay ?? d.getUTCDate()).getTime());
      break;
  }
}

/**
 * The k-th slot (k = 0 is the start) of a recurring series, computed from the
 * series' start rather than from the previous occurrence, so a moved/deleted
 * occurrence can't shift the rest: weekly = start + 7k days, biweekly = + 14k,
 * monthly = start + k months on the start's day (clamped in short months).
 */
export function seriesSlot(start: Date, repeats: RepeatCadence, k: number): Date {
  const d = new Date(start);
  switch (repeats) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7 * k);
      return d;
    case 'biweekly':
      d.setUTCDate(d.getUTCDate() + 14 * k);
      return d;
    case 'monthly':
      return addMonthsClamped(start, k, start.getUTCDate());
    default:
      return d; // `once` has a single slot
  }
}

/** Index of the first slot on or after `from` (0 when `from` is before the start). */
export function firstSlotIndexOnOrAfter(start: Date, repeats: RepeatCadence, from: Date): number {
  if (repeats === 'once' || from <= start) return 0;
  let k: number;
  if (repeats === 'monthly') {
    k = (from.getUTCFullYear() - start.getUTCFullYear()) * 12 + (from.getUTCMonth() - start.getUTCMonth()) - 1;
  } else {
    const period = (repeats === 'weekly' ? 7 : 14) * 86_400_000;
    k = Math.floor((from.getTime() - start.getTime()) / period) - 1;
  }
  k = Math.max(0, k);
  while (seriesSlot(start, repeats, k) < from) k++;
  return k;
}

/** Parse a "YYYY-MM-DD" form value into a UTC-midnight calendar date. */
export function parseCalendarDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * Is this a real "YYYY-MM-DD" calendar day? Rejects malformed strings and
 * impossible days like 2026-02-30 (which Date would silently roll to Mar 2).
 */
export function isValidYmd(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = parseCalendarDate(ymd);
  return !Number.isNaN(d.getTime()) && toYmd(d) === ymd;
}

/** Is this a 24h "HH:mm" time (what a native time input sends)? */
export function isValidHhmm(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/** "YYYY-MM-DD" from a UTC-midnight calendar date — the inverse of parseCalendarDate. */
export function toYmd(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Every "YYYY-MM-DD" from start to end inclusive (UTC calendar days). Used to
 * expand an availability range into its individual days for calendar dots and
 * day-by-day grouping. Capped at ~1 year as a guard against a pathological range.
 */
export function eachDayYmd(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  const cur = parseCalendarDate(startYmd);
  const end = parseCalendarDate(endYmd);
  for (let i = 0; cur <= end && i < 366; i++) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Initial occurrence dates for a newly created event.
 * `once` → a single date. Recurring → every cadence slot from the seed that
 * falls inside the 4-week horizon (seed included; horizon end exclusive), so
 * weekly → 4, biweekly → 2, monthly → 1. The window is then rolled forward over
 * time by ensureRecurringWindow.
 */
export function generateOccurrences(seed: Date, repeats: RepeatCadence): Date[] {
  if (repeats === 'once') return [new Date(seed)];

  // Same slot math as ensureRecurringWindow (seed = the series' start).
  const end = seriesHorizonEnd(seed);
  const occurrences: Date[] = [];
  for (let k = 0; ; k++) {
    const slot = seriesSlot(seed, repeats, k);
    if (slot >= end) break;
    occurrences.push(slot);
  }
  return occurrences;
}

/** "YYYY-MM" key for a date (used for Setlist.month), read in UTC. */
export function monthKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatEventDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Compact inclusive date range for display, from two "YYYY-MM-DD" keys.
 * Single day → "Sun, Jan 5"; same month → "Jan 5 – 20"; spanning months →
 * "Jan 28 – Feb 3". Read in UTC like every other calendar-date helper.
 */
export function formatDateRange(startYmd: string, endYmd: string): string {
  if (startYmd === endYmd) return formatEventDate(parseCalendarDate(startYmd));
  const start = parseCalendarDate(startYmd);
  const end = parseCalendarDate(endYmd);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  const startLabel = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const endLabel = end.toLocaleDateString('en-US', {
    ...(sameMonth ? {} : { month: 'short' }),
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${startLabel} – ${endLabel}`;
}

/** Convert "HH:mm" 24h to a friendly "9:00 AM" label. */
export function formatTimeLabel(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
