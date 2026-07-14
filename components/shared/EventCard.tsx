'use client';

import type { EventDTO, EventAssignmentDTO } from '@/lib/serialize';
import { EventTypeBadge } from './EventTypeBadge';
import { Calendar, Clock, MapPin, Shirt, Repeat, Music } from './Icons';
import { formatEventDate, formatTimeLabel } from '@/lib/dates';

export const VOCAL_PARTS = ['Soprano', 'Alto', 'Tenor'] as const;

export function hasAttire(e: EventDTO): boolean {
  // Attire only applies to Service and Other events; ignore any leftover data
  // on other types (e.g. an event whose type was changed after the fact).
  if (e.type !== 'service' && e.type !== 'other') return false;
  return Boolean(
    e.attirePrimary || e.attireSecondary || e.attireComplement || e.attireNotes || e.attirePhotos.length,
  );
}

/** Singing assignments only apply to Service events — ignore leftovers elsewhere. */
export function eventAssignments(e: EventDTO): EventAssignmentDTO[] {
  return e.type === 'service' ? e.assignments : [];
}

/** Assigned singers grouped by part, in S/A/T order; empty parts are dropped. */
export function assignmentsByPart(e: EventDTO): { part: string; names: string[] }[] {
  const rows = eventAssignments(e);
  return VOCAL_PARTS.map((part) => ({
    part,
    names: rows.filter((a) => a.part === part).map((a) => a.name),
  })).filter((g) => g.names.length > 0);
}

export function EventCard({ event, onClick }: { event: EventDTO; onClick?: () => void }) {
  const parts = assignmentsByPart(event);
  return (
    <button
      type="button"
      onClick={onClick}
      className="card row-press w-full animate-rise p-4 text-left"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-semibold leading-tight">{event.eventName}</h3>
        <EventTypeBadge type={event.type} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Calendar width={15} height={15} className="text-ink-faint" />
          {formatEventDate(new Date(event.date))}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock width={15} height={15} className="text-ink-faint" />
          {formatTimeLabel(event.time)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-faint">
        <MapPin width={15} height={15} />
        <span className="truncate">{event.location}</span>
      </div>
      {(event.repeats !== 'once' || event.setlistId || hasAttire(event)) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {event.repeats !== 'once' && (
            <span className="chip bg-surface-2 text-ink-soft capitalize">
              <Repeat width={13} height={13} /> {event.repeats}
            </span>
          )}
          {event.setlistId && (
            <span className="chip bg-surface-2 text-ink-soft">
              <Music width={13} height={13} /> Setlist
            </span>
          )}
          {hasAttire(event) && (
            <span className="chip bg-surface-2 text-ink-soft">
              <Shirt width={13} height={13} /> Attire
            </span>
          )}
        </div>
      )}
      {/* Singing assignments — at most three tight lines (S/A/T), names truncated. */}
      {parts.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-line pt-2.5">
          {parts.map(({ part, names }) => (
            <div key={part} className="flex items-center gap-2 text-xs">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-accent/10 text-[10px] font-bold text-accent-ink dark:text-accent-on">
                {part[0]}
              </span>
              <span className="truncate text-ink-soft">{names.join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
