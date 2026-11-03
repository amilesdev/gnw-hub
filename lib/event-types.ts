import type { EventType } from '@prisma/client';

// Which event types carry which optional sections. Encounter Night is staffed
// like a Sunday service, so it shares Service's singing assignments, attire and
// setlist. Keep these lists as the single source — the form, API, cards and the
// availability conflict check all read them.

/** Types that carry singing assignments (EventAssignment rows). */
export const ASSIGNMENT_EVENT_TYPES = ['service', 'encounter_night'] as const satisfies readonly EventType[];

/** Types that carry attire. */
export const ATTIRE_EVENT_TYPES = ['service', 'encounter_night', 'other'] as const satisfies readonly EventType[];

/** Types that can be linked to a setlist (Prayer and Holy Talks never are). */
export const SETLIST_EVENT_TYPES = ['service', 'encounter_night', 'rehearsal', 'other'] as const satisfies readonly EventType[];

// Take a loose string: callers pass form state and pre-validation request types.
export const carriesAssignments = (type?: string | null) => (ASSIGNMENT_EVENT_TYPES as readonly string[]).includes(type ?? '');
export const carriesAttire = (type?: string | null) => (ATTIRE_EVENT_TYPES as readonly string[]).includes(type ?? '');
