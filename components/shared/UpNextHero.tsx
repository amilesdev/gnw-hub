'use client';

import type { ComponentType, SVGProps } from 'react';
import type { EventDTO } from '@/lib/serialize';
import { EventTypeEyebrow, EVENT_TEXT_STYLES } from './EventTypeBadge';
import { Calendar, Music, Book, Pray } from './Icons';
import { daysUntil } from '@/lib/dates';
import { downloadEventICS } from '@/lib/calendar';
import { timeAndPlace } from './EventCard';
import { cn } from '@/lib/utils';

// The primary action label + icon changes with the event type: services,
// rehearsals and "other" carry a setlist; holy talks carry a topic; prayer
// events carry a prayer list. "Add to calendar" is offered for all of them.
function primaryAction(event: EventDTO): { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> } | null {
  switch (event.type) {
    case 'holy_talks':
      return { label: 'View topic', icon: Book };
    case 'prayer':
      return { label: 'View prayer list', icon: Pray };
    default:
      // No setlist yet → no "View setlist" (it would open an empty section).
      return event.setlistId ? { label: 'View setlist', icon: Music } : null;
  }
}

export const countdownLabel = (days: number) =>
  days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;

/**
 * "Up next" (HM-C3): the soonest event as a glass card over the header glow —
 * a droplet date tile, the event, a text countdown and quick actions. Tapping
 * the card or the primary action opens Event detail; "Add to calendar"
 * downloads an .ics.
 */
export function UpNextHero({ event, onOpen }: { event: EventDTO; onOpen: () => void }) {
  const action = primaryAction(event);
  const days = daysUntil(new Date(event.date));
  const d = new Date(event.date);
  const meta = timeAndPlace(event);

  return (
    <div className="glass relative flex animate-rise flex-col gap-4 rounded-4xl p-[18px]">
      <button type="button" onClick={onOpen} aria-label={`Open ${event.eventName}`} className="absolute inset-0 z-0 rounded-4xl" />
      <div className="pointer-events-none relative flex items-start gap-4">
        <div className="glass-drop flex h-[72px] w-16 shrink-0 flex-col items-center justify-center rounded-[18px]">
          <span
            className={cn(
              'text-[11px] font-bold uppercase leading-[14px] tracking-[0.1em]',
              event.crossoverKind ? 'text-crossover-gold-ink dark:text-crossover-gold' : EVENT_TEXT_STYLES[event.type],
            )}
          >
            {d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
          </span>
          <span className="numeral-lg text-ink">{d.getUTCDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <EventTypeEyebrow event={event} />
          <h3 className="t-title-card mt-1 text-ink">{event.eventName}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
            {meta && `${meta} · `}
            <span className="font-bold text-accent-ink">{countdownLabel(days)}</span>
          </p>
        </div>
      </div>

      {/* The row spans the card's content box, so the full-width calendar
          bubble runs from the date tile's left edge to the text's right edge. */}
      <div className="relative flex flex-col gap-2.5">
        {action && (
          // Green droplet pill: same bubble as below, kept in the accent so the two differ.
          <button
            type="button"
            onClick={onOpen}
            className="btn glass-drop-accent min-w-0 w-full gap-1.5 rounded-full px-3.5"
          >
            <action.icon width={18} height={18} className="shrink-0" />
            <span className="truncate">{action.label}</span>
          </button>
        )}
        {/* Same liquid-glass droplet as the date tile, as a pill. */}
        <button
          type="button"
          onClick={() => downloadEventICS(event)}
          className="btn glass-drop min-w-0 w-full gap-1.5 rounded-full px-3.5 text-ink"
        >
          <Calendar width={18} height={18} className="shrink-0" />
          <span className="truncate">Add to calendar</span>
        </button>
      </div>
    </div>
  );
}
