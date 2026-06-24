import type { EventType } from '@prisma/client';
import { cn } from '@/lib/utils';

const LABELS: Record<EventType, string> = {
  service: 'Service',
  rehearsal: 'Rehearsal',
  prayer: 'Prayer',
  holy_talks: 'Holy Talks',
  other: 'Other',
};

// Tinted badge pattern (§3): light bubble + deeper text of the same hue.
// Muted, earthy hues per the brand doc — service=sage green, rehearsal=amber,
// holy_talks=slate-blue, prayer=brick red, other=pink.
const STYLES: Record<EventType, string> = {
  service: 'bg-accent/10 text-accent-ink dark:text-accent-on',
  rehearsal: 'bg-warn/15 text-[#8F5E1C] dark:text-[#E0A75E]',
  holy_talks: 'bg-info/15 text-info',
  prayer: 'bg-bad/15 text-bad dark:text-[#D98A84]',
  other: 'bg-[#A8708A]/15 text-[#8A4E6A] dark:text-[#CFA0B8]',
};

// Solid version of the same hues, for calendar day dots.
export const EVENT_DOT_STYLES: Record<EventType, string> = {
  service: 'bg-accent',
  rehearsal: 'bg-warn',
  holy_talks: 'bg-info',
  prayer: 'bg-bad',
  other: 'bg-[#A8708A]',
};

export function EventTypeBadge({ type, className }: { type: EventType; className?: string }) {
  return <span className={cn('chip', STYLES[type], className)}>{LABELS[type]}</span>;
}

export const eventTypeLabel = (type: EventType) => LABELS[type];
