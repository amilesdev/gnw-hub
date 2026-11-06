'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { EventDTO, EventAssignmentDTO, CallDTO } from '@/lib/serialize';
import { EventTypeEyebrow } from './EventTypeBadge';
import { ChevronRight, MoreHorizontal, Repeat, Phone } from './Icons';
import { formatTimeLabel } from '@/lib/dates';
import { canStartPrayerCall, isPrayerCallOpen } from '@/lib/prayer-call';
import { apiFetch } from '@/lib/api-client';
import { carriesAssignments, carriesAttire } from '@/lib/event-types';
import { cn } from '@/lib/utils';
import { listCard } from '@/lib/ui-classes';

export const VOCAL_PARTS = ['Soprano', 'Alto', 'Tenor'] as const;

export function hasAttire(e: EventDTO): boolean {
  // Attire only applies to Service, Encounter Night and Other events; ignore any
  // leftover data on other types (e.g. an event whose type was changed after the fact).
  if (!carriesAttire(e.type)) return false;
  return Boolean(
    e.attirePrimary || e.attireSecondary || e.attireComplement || e.attireNotes || e.attirePhotos.length,
  );
}

/** Singing assignments only apply to Service and Encounter Night events — ignore leftovers elsewhere. */
export function eventAssignments(e: EventDTO): EventAssignmentDTO[] {
  return carriesAssignments(e.type) ? e.assignments : [];
}

/**
 * Assigned singers grouped by part, in S/A/T order; empty parts are dropped.
 * Fed the S/A/T summary that event cards used to carry; kept for when that
 * summary comes back to rows (redesign decision #4 may change).
 */
export function assignmentsByPart(e: EventDTO): { part: string; names: string[] }[] {
  const rows = eventAssignments(e);
  return VOCAL_PARTS.map((part) => ({
    part,
    names: rows.filter((a) => a.part === part).map((a) => a.name),
  })).filter((g) => g.names.length > 0);
}

/** The part the viewer is singing at this event, if they're assigned (leader or member). */
export function useMyPart(e: EventDTO): string | null {
  const { data: session } = useSession();
  const uid = session?.user?.id;
  if (!uid) return null;
  return eventAssignments(e).find((a) => a.userId === uid)?.part ?? null;
}

/** Date block for a row: "SUN" over the day numeral, read in UTC (calendar day). */
function DateBlock({ date }: { date: string }) {
  const d = new Date(date);
  return (
    <span className="flex w-11 shrink-0 flex-col items-center">
      <span className="text-[11px] font-bold uppercase leading-[14px] tracking-[0.1em] text-ink-faint">
        {d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
      </span>
      <span className="numeral">{d.getUTCDate()}</span>
    </span>
  );
}

/** "{time} · {location}" without a dangling dot when either is missing. */
export function timeAndPlace(e: EventDTO) {
  return [formatTimeLabel(e.time), e.location].filter(Boolean).join(' · ');
}

/**
 * Event row (EV-C1): date block, type eyebrow, name, time · place, and "You're
 * singing {Part}" when the viewer is assigned. Members get a chevron; pass
 * `onMore` (leaders) for the More button that opens the action sheet. The
 * Setlist/Attire chips and S/A/T summary live on Event detail, one tap away.
 */
export function EventRow({
  event,
  onClick,
  onMore,
  className,
}: {
  event: EventDTO;
  onClick?: () => void;
  onMore?: () => void;
  className?: string;
}) {
  const myPart = useMyPart(event);
  return (
    // The whole row opens the detail via an invisible full-bleed button behind
    // the content, so More and "Start Call" can be real buttons without nesting.
    <div
      className={cn(
        'row-press relative flex min-h-[72px] items-center gap-3.5 py-3 pl-4',
        onMore ? 'pr-1.5' : 'pr-4',
        className,
      )}
    >
      <button type="button" onClick={onClick} aria-label={`Open ${event.eventName}`} className="absolute inset-0 z-0" />
      <div className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-3.5">
        <DateBlock date={event.date} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <EventTypeEyebrow event={event} />
          <p className="row-title truncate">{event.eventName}</p>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-ink-soft">
            <span className="truncate">{timeAndPlace(event)}</span>
            {event.repeats !== 'once' && (
              <Repeat width={13} height={13} className="shrink-0 text-ink-faint" aria-label={`Repeats ${event.repeats}`} />
            )}
          </p>
          {myPart && <p className="text-[13px] font-bold leading-[18px] text-accent-ink">You’re singing {myPart}</p>}
          <PrayerCallButton event={event} />
        </div>
      </div>
      {onMore ? (
        <button type="button" onClick={onMore} className="btn-icon relative z-10" aria-label={`More for ${event.eventName}`}>
          <MoreHorizontal width={20} height={20} />
        </button>
      ) : (
        <ChevronRight width={18} height={18} className="pointer-events-none relative shrink-0 text-ink-faint" aria-hidden />
      )}
    </div>
  );
}

/** One card of event rows with inset hairline dividers (CMP-11 list-in-card). */
export function EventRowList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(listCard, 'animate-rise', className)}
    >
      {children}
    </div>
  );
}

/** A single event row in its own card (screens that list events one by one). */
export function EventCard({ event, onClick, onMore }: { event: EventDTO; onClick?: () => void; onMore?: () => void }) {
  return (
    <EventRowList>
      <EventRow event={event} onClick={onClick} onMore={onMore} />
    </EventRowList>
  );
}

/**
 * Prayer "Start Call" pill (EV-C5), inside the row, only for the designated
 * starters (Alonzo, Aleena, Judy) and only from 15 min before the event through
 * 60 min after it starts. Starting it rings the whole team and pushes a notice.
 */
function PrayerCallButton({ event }: { event: EventDTO }) {
  const router = useRouter();
  const { data: session } = useSession();
  const allowed = event.type === 'prayer' && canStartPrayerCall(session?.user?.email);

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
    <div className="pointer-events-auto relative z-10 mt-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-[20px] bg-accent-soft pl-1 pr-3.5 transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
          <span className="absolute inset-0 animate-pulse-ring rounded-full ring-2 ring-accent" aria-hidden />
          <Phone width={15} height={15} />
        </span>
        <span className="text-sm font-bold text-accent-ink">{busy ? 'Starting…' : 'Start Call'}</span>
      </button>
      {error && <p className="mt-1.5 text-[13px] font-semibold text-bad-ink">{error}</p>}
    </div>
  );
}
