import { APP_TIME_ZONE } from '@/lib/dates';

// Chat times are shown in the team's time zone (Eastern), not the device's, so
// the server render and the phone agree on which day a message falls on — day
// dividers are structure, and a mismatch would break hydration. Only labels
// relative to "now" (Today / Yesterday) can still differ at a midnight edge;
// those spans use suppressHydrationWarning.

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, hour: 'numeric', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, weekday: 'long' });
const shortDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' });
const fullDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric' });
const monthDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, month: 'short', day: 'numeric' });

/** "2026-11-05" — the Eastern calendar day of an instant. */
export function dayKey(iso: string | Date): string {
  return dayKeyFmt.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** Whole days between two day keys (b − a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** "3:42 PM" */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** Day divider: "Today", "Yesterday", "Monday" (this week), "Tue, Nov 3", "Nov 3, 2025". */
export function formatDayDivider(iso: string, now = new Date()): string {
  const d = dayKey(iso);
  const diff = dayDiff(d, dayKey(now));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const date = new Date(iso);
  if (diff > 1 && diff < 7) return weekdayFmt.format(date);
  if (d.slice(0, 4) === dayKey(now).slice(0, 4)) return shortDayFmt.format(date);
  return fullDayFmt.format(date);
}

/** Chat-list stamp: time today, "Yesterday", weekday this week, else "Nov 3". */
export function formatListStamp(iso: string, now = new Date()): string {
  const diff = dayDiff(dayKey(iso), dayKey(now));
  const date = new Date(iso);
  if (diff === 0) return timeFmt.format(date);
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return weekdayFmt.format(date).slice(0, 3);
  return monthDayFmt.format(date);
}

/** Search-hit stamp: like the list, but older years say so ("Nov 3, 2025") — imported history goes back. */
export function formatSearchStamp(iso: string, now = new Date()): string {
  return dayKey(iso).slice(0, 4) === dayKey(now).slice(0, 4) ? formatListStamp(iso, now) : fullDayFmt.format(new Date(iso));
}

/** Split text into plain runs and http(s) links, for rendering links tappable. */
export function linkify(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = [];
  const re = /\bhttps?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/gi;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], href: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** A send's idempotency key. */
export function newClientNonce(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
