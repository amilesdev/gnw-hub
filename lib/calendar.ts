import type { EventDTO } from './serialize';

// Client-side "Add to calendar" — builds a standards-compliant .ics file for a
// single event and triggers a download. On phones this opens the native
// calendar's import sheet; on desktop it saves the file.
//
// Event dates are stored as a UTC calendar day (see lib/dates.ts) with the
// time-of-day in the separate `time` string. We emit a *floating* local
// date-time (no timezone / no trailing Z) so the calendar app shows the event
// at that wall-clock time wherever the member is — matching how the rest of the
// app labels times.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Floating local timestamp "YYYYMMDDTHHMMSS" from a Date's local components. */
function stamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/** Escape reserved ICS characters in free-text values. */
function esc(s: string): string {
  return (s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

export function downloadEventICS(event: EventDTO): void {
  // The stored date is UTC-midnight of the calendar day; read it with UTC
  // getters, then anchor the "HH:mm" time onto it as floating local time.
  const day = new Date(event.date);
  const [h, m] = (event.time || '00:00').split(':').map(Number);
  const start = new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h || 0, m || 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1-hour block

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GNW Hub//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@gnw-hub`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(event.eventName)}`,
    event.location ? `LOCATION:${esc(event.location)}` : '',
    event.notes ? `DESCRIPTION:${esc(event.notes)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.eventName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
