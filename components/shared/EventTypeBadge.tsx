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

// Tinted badge pattern (§3): light bubble + deeper text of the same hue.
// Muted, earthy hues per the brand doc — service=sage green, rehearsal=amber,
// holy_talks=slate-blue, prayer=brick red, encounter_night=plum, other=pink.
const STYLES: Record<EventType, string> = {
  service: 'bg-accent/10 text-accent-ink dark:text-accent-on',
  rehearsal: 'bg-warn/15 text-[#8F5E1C] dark:text-[#E0A75E]',
  holy_talks: 'bg-info/15 text-info',
  prayer: 'bg-bad/15 text-bad dark:text-[#D98A84]',
  encounter_night: 'bg-[#6E5A9E]/15 text-[#56448A] dark:text-[#B9A8E3]',
  other: 'bg-[#A8708A]/15 text-[#8A4E6A] dark:text-[#CFA0B8]',
};

// Solid version of the same hues, for calendar day dots.
export const EVENT_DOT_STYLES: Record<EventType, string> = {
  service: 'bg-accent',
  rehearsal: 'bg-warn',
  holy_talks: 'bg-info',
  prayer: 'bg-bad',
  encounter_night: 'bg-[#6E5A9E]',
  other: 'bg-[#A8708A]',
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

/** Text label for an event: "Crossover · GNW Rehearsal" for Crossover events, else its type. */
export function eventLabel(event: BadgeEvent): string {
  if (!event.crossoverKind) return LABELS[event.type];
  return event.crossoverKind === 'crossover' || event.crossoverKind === 'other'
    ? 'Crossover'
    : `Crossover · ${CROSSOVER_KIND_LABELS[event.crossoverKind]}`;
}
