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

export function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** True if the announcement expires within the next 24 hours. */
export function expiringSoon(iso: string): boolean {
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 && ms <= 24 * 60 * 60 * 1000;
}
