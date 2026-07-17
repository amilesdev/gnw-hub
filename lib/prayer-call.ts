// Access + timing rules for the per-event "Start Call" button that appears on
// Prayer events. Pure (no DB / no server-only imports) so the EventCard (client)
// and the /api/calls/prayer route (server) share one source of truth.

// The worship team runs on Eastern time (see lib/bible.ts); event `time` strings
// are wall-clock in this zone, with no timezone of their own.
const TEAM_TIME_ZONE = 'America/New_York';

// Only these specific people may start a Prayer call. Matched on display name
// (set by a leader and revalidated each request), normalized for casing/spacing.
export const PRAYER_CALLER_NAMES = ['Alonzo Miles', 'Aleena Figueroa', 'Judy Felix'];

// Window: opens 15 min before the event start and closes 60 min after it.
const OPEN_BEFORE_MS = 15 * 60_000;
const CLOSE_AFTER_MS = 60 * 60_000;

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

const prayerCallerSet = new Set(PRAYER_CALLER_NAMES.map(normalizeName));

/** Whether a user (by display name) is one of the designated Prayer-call starters. */
export function canStartPrayerCall(name: string | null | undefined): boolean {
  return !!name && prayerCallerSet.has(normalizeName(name));
}

/** Offset (ms) of `tz` from UTC at the given instant — DST-aware. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - utcMs;
}

/** The UTC instant of an Eastern wall-clock day + "HH:mm" time, or null if malformed. */
export function eventStartInstant(dateYmd: string, time: string): Date | null {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  const [h, mi] = (time ?? '').split(':').map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
  // Treat the wall-clock as UTC, then correct by the zone's offset at that moment.
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(naive - tzOffsetMs(naive, TEAM_TIME_ZONE));
}

/**
 * Whether the Prayer-call window is currently open for an event starting at
 * `dateYmd` ("YYYY-MM-DD") + `time` ("HH:mm"). Caller checks the event is a
 * Prayer event; this only handles the timing.
 */
export function isPrayerCallOpen(dateYmd: string, time: string, now: number = Date.now()): boolean {
  const start = eventStartInstant(dateYmd, time);
  if (!start) return false;
  const s = start.getTime();
  return now >= s - OPEN_BEFORE_MS && now <= s + CLOSE_AFTER_MS;
}
