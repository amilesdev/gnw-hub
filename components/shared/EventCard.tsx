'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { EventDTO, EventAssignmentDTO, CallDTO } from '@/lib/serialize';
import { EventTypeBadge } from './EventTypeBadge';
import { Calendar, Clock, MapPin, Shirt, Repeat, Music, Phone } from './Icons';
import { formatEventDate, formatTimeLabel } from '@/lib/dates';
import { canStartPrayerCall, isPrayerCallOpen } from '@/lib/prayer-call';
import { apiFetch } from '@/lib/api-client';

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
    // The whole card opens the detail sheet via an invisible full-bleed button
    // behind the content, so the "Start Call" button (Prayer events only) can be
    // a real, focusable button in the flow without nesting buttons.
    <div className="card row-press relative w-full animate-rise p-4 text-left">
      <button
        type="button"
        onClick={onClick}
        aria-label={`Open ${event.eventName}`}
        className="absolute inset-0 z-0"
      />
      <div className="pointer-events-none relative">
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
        {/* Prayer events only: an in-flow Start Call button for designated people. */}
        <PrayerCallButton event={event} />
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
      </div>
    </div>
  );
}

/**
 * "Start Call" button shown only on Prayer event cards, only for the designated
 * starters (Alonzo, Aleena, Judy), and only from 15 min before the event through
 * 60 min after it starts. Starting it rings the whole team and pushes a notice.
 */
function PrayerCallButton({ event }: { event: EventDTO }) {
  const router = useRouter();
  const { data: session } = useSession();
  const allowed = event.type === 'prayer' && canStartPrayerCall(session?.user?.name);

  // The window opens/closes on a clock, so re-check periodically while mounted.
  const [open, setOpen] = useState(() => allowed && isPrayerCallOpen(event.date.slice(0, 10), event.time));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    const tick = () => setOpen(isPrayerCallOpen(event.date.slice(0, 10), event.time));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [allowed, event.date, event.time]);

  if (!allowed || !open) return null;

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const { call } = await apiFetch<{ call: CallDTO }>('/api/calls/prayer', {
        method: 'POST',
        body: JSON.stringify({ eventId: event.id }),
      });
      router.push(`/call/${call.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the call.');
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto relative z-10 mt-3">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="row-press inline-flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent-soft px-3 py-2.5 disabled:opacity-60"
      >
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white shadow-pop">
          <span className="absolute inset-0 rounded-full ring-2 ring-accent animate-pulse-ring" aria-hidden />
          <Phone width={18} height={18} />
        </span>
        <span className="font-semibold text-ink">{busy ? 'Starting…' : 'Start Call'}</span>
      </button>
      {error && <p className="mt-1.5 text-xs font-semibold text-bad">{error}</p>}
    </div>
  );
}
