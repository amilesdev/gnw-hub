import { startOfToday, toYmd } from './dates';

type Dated = { date: string };

/**
 * Agenda groups (EV-1): "Today", "This week" (the rest of it, through Sunday),
 * "Next week", then one group per month ("December", "January 2027" once the
 * year changes). Event dates are UTC-midnight calendar days and "today" is the
 * Eastern calendar day (lib/dates → startOfToday), so everything compares in
 * UTC. Input is assumed sorted soonest first; order is kept within a group.
 */
export function groupAgenda<T extends Dated>(events: T[], today: Date = startOfToday()): { label: string; events: T[] }[] {
  const DAY = 86_400_000;
  const t0 = today.getTime();
  const toSunday = (7 - today.getUTCDay()) % 7; // Sunday ends the week
  const endThisWeek = t0 + toSunday * DAY;
  const endNextWeek = endThisWeek + 7 * DAY;
  const year = today.getUTCFullYear();

  const groups: { label: string; events: T[] }[] = [];
  const push = (label: string, e: T) => {
    const last = groups[groups.length - 1];
    if (last?.label === label) last.events.push(e);
    else groups.push({ label, events: [e] });
  };

  for (const e of events) {
    const d = new Date(e.date);
    const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (t <= t0) push('Today', e);
    else if (t <= endThisWeek) push('This week', e);
    else if (t <= endNextWeek) push('Next week', e);
    else {
      const month = d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
      push(d.getUTCFullYear() === year ? month : `${month} ${d.getUTCFullYear()}`, e);
    }
  }
  return groups;
}

/** The 7 calendar days starting today (Eastern), as "YYYY-MM-DD" keys. */
export function weekStripDays(today: Date = startOfToday()): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    return toYmd(d);
  });
}
