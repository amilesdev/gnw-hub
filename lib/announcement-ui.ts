import { ANNOUNCEMENT_MAX_DAYS } from '@/lib/validation';

export { ANNOUNCEMENT_MAX_DAYS };

/** Value for a <input type="datetime-local"> from a Date (local, no seconds). */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toLocalInput(d);
}

export function maxExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + ANNOUNCEMENT_MAX_DAYS);
  return toLocalInput(d);
}

export function minExpiry(): string {
  return toLocalInput(new Date());
}

export function formatPosted(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Compact "when posted" for the author byline: "just now", "2h ago", "Yesterday", else a date. */
export function formatRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatPosted(iso);
}

export function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** True if the announcement expires within the next 24 hours. */
export function expiringSoon(iso: string): boolean {
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 && ms <= 24 * 60 * 60 * 1000;
}
