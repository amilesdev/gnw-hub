'use client';

import type { ComponentType, SVGProps } from 'react';
import type { EventDTO } from '@/lib/serialize';
import { eventTypeLabel } from './EventTypeBadge';
import { Calendar, MapPin, Music, Book, Pray } from './Icons';
import { formatEventDate, formatTimeLabel, daysUntil } from '@/lib/dates';
import { downloadEventICS } from '@/lib/calendar';

// The primary action label + icon changes with the event type: services,
// rehearsals and "other" carry a setlist; holy talks carry a topic; prayer
// events carry a prayer list. "Add to calendar" is offered for all of them.
function primaryAction(type: EventDTO['type']): { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> } {
  switch (type) {
    case 'holy_talks':
      return { label: 'View topic', icon: Book };
    case 'prayer':
      return { label: 'View prayer list', icon: Pray };
    default:
      return { label: 'View setlist', icon: Music };
  }
}

function Countdown({ days }: { days: number }) {
  const [big, unit] = days <= 0 ? ['Today', ''] : days === 1 ? ['1', 'day'] : [String(days), 'days'];
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15 text-center ring-1 ring-inset ring-white/30 backdrop-blur">
      <div>
        <div className={unit ? 'font-display text-xl font-bold leading-none' : 'font-display text-sm font-bold leading-none'}>
          {big}
        </div>
        {unit && <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/80">{unit}</div>}
      </div>
    </div>
  );
}

/**
 * "Up next" hero — the soonest upcoming event, promoted to a signature card
 * with a live day-countdown and quick actions. Tapping the primary action opens
 * the same event detail as an event card; "Add to calendar" downloads an .ics.
 */
export function UpNextHero({ event, onOpen }: { event: EventDTO; onOpen: () => void }) {
  const { label, icon: ActionIcon } = primaryAction(event.type);
  const days = daysUntil(new Date(event.date));

  return (
    <div className="grain-block relative animate-rise overflow-hidden rounded-3xl bg-gradient-to-br from-accent to-accent-ink p-4 text-white shadow-card-lg">
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-white/70" aria-hidden />
            {eventTypeLabel(event.type)}
          </span>
          <h2 className="mt-1.5 font-display text-xl font-semibold leading-tight">{event.eventName}</h2>
        </div>
        <Countdown days={days} />
      </div>

      <div className="relative mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/90">
        <span className="inline-flex items-center gap-1.5">
          <Calendar width={15} height={15} className="text-white/70" />
          {formatEventDate(new Date(event.date))} · {formatTimeLabel(event.time)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin width={15} height={15} className="text-white/70" />
          <span className="truncate">{event.location}</span>
        </span>
      </div>

      <div className="relative mt-4 flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="row-press inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-accent-ink"
        >
          <ActionIcon width={16} height={16} /> {label}
        </button>
        <button
          type="button"
          onClick={() => downloadEventICS(event)}
          className="row-press inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white"
        >
          <Calendar width={16} height={16} /> Add to calendar
        </button>
      </div>
    </div>
  );
}
