import type { RepeatCadence } from '@prisma/client';

export const UPCOMING_WINDOW_DAYS = 7;

// Event dates represent a calendar day with no time-of-day meaning (the
// time-of-day lives in the separate `time` string). To stay consistent between
// the local dev server and Vercel's UTC server — and between server and browser
// — every calendar-date value is anchored to UTC midnight and read with UTC
// getters. Mixing local and UTC is what made a Sunday render as Saturday.

/** Start of today at 00:00 UTC. */
export function startOfToday(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
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

/** Advance a date in place by one cadence step (UTC). No-op for `once`. */
export function stepDate(d: Date, repeats: RepeatCadence): void {
  switch (repeats) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'biweekly':
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
  }
}

/** Parse a "YYYY-MM-DD" form value into a UTC-midnight calendar date. */
export function parseCalendarDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
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

  const end = seriesHorizonEnd(seed);
  const occurrences: Date[] = [];
  const cursor = new Date(seed);
  while (cursor < end) {
    occurrences.push(new Date(cursor));
    stepDate(cursor, repeats);
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

/** Convert "HH:mm" 24h to a friendly "9:00 AM" label. */
export function formatTimeLabel(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
