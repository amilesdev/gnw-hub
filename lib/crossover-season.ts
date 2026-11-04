import type { CrossoverKind, EventType, Role } from '@prisma/client';
import { APP_TIME_ZONE } from '@/lib/dates';

// Crossover — the ministry's year-end event on Dec 31. Its season runs Sep 1 –
// Dec 31 (Eastern): leaders get the tab on Sep 1, members on Oct 1, and it
// hides again on Jan 1. Client-safe (no Prisma runtime imports), so the tab
// bar, the countdown and the API all read the same rules. The server half —
// creating seasons and sending the kickoff pushes — is lib/crossover.ts.

export const CROSSOVER_KINDS = [
  'gnw_rehearsal',
  'all_team_rehearsal',
  'dress_rehearsal',
  'setup',
  'crossover',
  'other',
] as const satisfies readonly CrossoverKind[];

export const CROSSOVER_KIND_LABELS: Record<CrossoverKind, string> = {
  gnw_rehearsal: 'GNW Rehearsal',
  all_team_rehearsal: 'All-Team Rehearsal',
  dress_rehearsal: 'Dress Rehearsal',
  setup: 'Setup',
  crossover: 'Crossover',
  other: 'Other',
};

/**
 * The regular event type a Crossover kind behaves as. GNW and All-Team
 * rehearsals are rehearsals (run-of-show, setlist link); everything else —
 * including the Dress Rehearsal, whose schedule is its own Crossover screen —
 * is "Other".
 */
export function crossoverKindToType(kind: CrossoverKind): EventType {
  return kind === 'gnw_rehearsal' || kind === 'all_team_rehearsal' ? 'rehearsal' : 'other';
}

/** Today's Eastern calendar day as numbers (month is 1-based). */
export function easternToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
}

/** First month (1-based) each role can see the season: leaders Sep, members Oct. */
const OPENS_IN_MONTH: Record<Role, number> = { leader: 9, member: 10 };

/** Is the Crossover tab (and this season's Crossover events) visible to this role today? */
export function crossoverOpenFor(role: Role, now: Date = new Date()): boolean {
  return easternToday(now).month >= OPENS_IN_MONTH[role];
}

/** Is a season running at all today (Sep 1 – Dec 31 Eastern)? */
export function crossoverSeasonActive(now: Date = new Date()): boolean {
  return easternToday(now).month >= 9;
}

/** The season year for an event date (a UTC-midnight calendar day), or null when it falls outside Sep–Dec. */
export function seasonYearForDate(date: Date): number | null {
  return date.getUTCMonth() >= 8 ? date.getUTCFullYear() : null;
}

/** Last calendar day a Crossover event (or recurring series) can land on: Dec 31 of its season. */
export function seasonEnd(year: number): Date {
  return new Date(Date.UTC(year, 11, 31));
}

/** The countdown target: Dec 31, 12:00 AM Eastern (EST is UTC-5 in December). */
export function crossoverCountdownTarget(year: number): number {
  return Date.UTC(year, 11, 31, 5, 0, 0);
}

/** From Dec 15 the schedule matters more than attire, so it moves to the top of the Crossover home. */
export function scheduleComesFirst(now: Date = new Date()): boolean {
  const { month, day } = easternToday(now);
  return month === 12 && day >= 15;
}

/** Total planned minutes across a season's sets (a set without a length counts as 0). */
export function totalMinutes(sets: { minutes: number | null }[]): number {
  return sets.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
}

type CrossoverFields = { date: string | Date; crossoverKind: CrossoverKind | null; crossoverLeadersOnly: boolean };

/**
 * Should this viewer see this event? Leaders see everything. Members never see
 * the leaders-only kickoff, and don't see this year's Crossover events until the
 * season opens for them on Oct 1. Past seasons' events stay visible (month view).
 */
export function crossoverVisibleTo(event: CrossoverFields, role: Role, now: Date = new Date()): boolean {
  if (role === 'leader' || !event.crossoverKind) return true;
  if (event.crossoverLeadersOnly) return false;
  if (crossoverOpenFor('member', now)) return true;
  const { year } = easternToday(now);
  return new Date(event.date).getTime() < Date.UTC(year, 8, 1);
}

/** Filter a list of events down to what this viewer may see (see crossoverVisibleTo). */
export function visibleEvents<T extends CrossoverFields>(events: T[], role: Role, now: Date = new Date()): T[] {
  return role === 'leader' ? events : events.filter((e) => crossoverVisibleTo(e, role, now));
}
