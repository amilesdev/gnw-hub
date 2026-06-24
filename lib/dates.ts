import type { RepeatCadence } from '@prisma/client';

export const UPCOMING_WINDOW_DAYS = 7;

/** Start of today (local) at 00:00. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** End of the upcoming window (7 days from start of today). */
export function upcomingWindowEnd(from: Date = startOfToday()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + UPCOMING_WINDOW_DAYS);
  d.setHours(23, 59, 59, 999);
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
  d.setDate(d.getDate() + SERIES_HORIZON_DAYS);
  return d;
}

/** Advance a date in place by one cadence step. No-op for `once`. */
export function stepDate(d: Date, repeats: RepeatCadence): void {
  switch (repeats) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
  }
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

/** "YYYY-MM" key for a date (used for Setlist.month). */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatEventDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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
