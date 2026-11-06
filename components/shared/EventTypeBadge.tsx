import type { CrossoverKind, EventType } from '@prisma/client';
import { cn } from '@/lib/utils';
import { CROSSOVER_KIND_LABELS } from '@/lib/crossover-season';
import { Sparkle } from './Icons';

const LABELS: Record<EventType, string> = {
  service: 'Service',
  rehearsal: 'Rehearsal',
  prayer: 'Prayer',
  holy_talks: 'Holy Talks',
  encounter_night: 'Encounter Night',
  other: 'Other',
};

// Event-type colours (EV-C2) are tokens (`--type-*` in globals.css): service
// sage, rehearsal amber, prayer rose, holy talks blue, encounter night plum,
// other a neutral stone. Chip = tinted bg + deeper text of the same hue.
const STYLES: Record<EventType, string> = {
  service: 'bg-type-service-bg text-type-service',
  rehearsal: 'bg-type-rehearsal-bg text-type-rehearsal',
  holy_talks: 'bg-type-holytalks-bg text-type-holytalks',
  prayer: 'bg-type-prayer-bg text-type-prayer',
  encounter_night: 'bg-type-encounter-bg text-type-encounter',
  other: 'bg-type-other-bg text-type-other',
};

// Text colour alone, for the dot + eyebrow in event rows.
export const EVENT_TEXT_STYLES: Record<EventType, string> = {
  service: 'text-type-service',
  rehearsal: 'text-type-rehearsal',
  holy_talks: 'text-type-holytalks',
  prayer: 'text-type-prayer',
  encounter_night: 'text-type-encounter',
  other: 'text-type-other',
};

// Solid version of the same hues, for row and calendar dots.
export const EVENT_DOT_STYLES: Record<EventType, string> = {
  service: 'bg-type-service-dot',
  rehearsal: 'bg-type-rehearsal-dot',
  holy_talks: 'bg-type-holytalks-dot',
  prayer: 'bg-type-prayer-dot',
  encounter_night: 'bg-type-encounter-dot',
  other: 'bg-type-other-dot',
};

export function EventTypeBadge({ type, className }: { type: EventType; className?: string }) {
  return <span className={cn('chip', STYLES[type], className)}>{LABELS[type]}</span>;
}

export const eventTypeLabel = (type: EventType) => LABELS[type];

type BadgeEvent = { type: EventType; crossoverKind: CrossoverKind | null };

/** The badge for an event: its type, or the evergreen Crossover badge for any Crossover event. */
export function EventBadge({ event, className }: { event: BadgeEvent; className?: string }) {
  if (!event.crossoverKind) return <EventTypeBadge type={event.type} className={className} />;
  return (
    <span className={cn('chip shrink-0 bg-crossover-ever text-crossover-gold-hi', className)}>
      <Sparkle width={12} height={12} aria-hidden />
      Crossover
    </span>
  );
}

/** Row eyebrow (EV-C1): a 6px type dot + the label in the type's text colour. */
export function EventTypeEyebrow({ event, className }: { event: BadgeEvent; className?: string }) {
  const crossover = !!event.crossoverKind;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em]',
        crossover ? 'text-crossover-gold-ink dark:text-crossover-gold' : EVENT_TEXT_STYLES[event.type],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 rounded-full', crossover ? 'bg-crossover-gold' : EVENT_DOT_STYLES[event.type])}
      />
      {eventLabel(event)}
    </span>
  );
}

/** Text label for an event: "Crossover · GNW Rehearsal" for Crossover events, else its type. */
export function eventLabel(event: BadgeEvent): string {
  if (!event.crossoverKind) return LABELS[event.type];
  return event.crossoverKind === 'crossover' || event.crossoverKind === 'other'
    ? 'Crossover'
    : `Crossover · ${CROSSOVER_KIND_LABELS[event.crossoverKind]}`;
}
