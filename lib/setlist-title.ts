import type { SetlistDTO } from './setlist-serialize';

/** A setlist's display name: its own, else its events' names, else `fallback`. */
export function setlistTitle(sl: Pick<SetlistDTO, 'name' | 'events'>, fallback = 'Setlist') {
  if (sl.name) return sl.name;
  if (sl.events.length) return Array.from(new Set(sl.events.map((e) => e.eventName))).join(' · ');
  return fallback;
}
