import type { Event, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { seriesHorizonEnd, startOfToday, stepDate } from '@/lib/dates';

// Safety cap so a long-dormant series can't loop forever while catching up.
const MAX_STEPS = 520;

/**
 * Build a new occurrence for a series from its anchor (latest) occurrence.
 * Only the structural identity carries forward (name, type, time, location,
 * cadence). Everything per-occurrence — attire, general notes, and Holy Talks
 * topic/scriptures — starts blank so each event is filled in independently.
 * Setlists are separate records, so a fresh occurrence naturally has none.
 */
function occurrenceFromAnchor(anchor: Event, date: Date): Prisma.EventCreateManyInput {
  return {
    eventName: anchor.eventName,
    type: anchor.type,
    date,
    time: anchor.time,
    location: anchor.location,
    repeats: anchor.repeats,
    seriesId: anchor.seriesId,
    notes: null,
    attirePrimary: null,
    attirePrimaryHex: null,
    attireSecondary: null,
    attireSecondaryHex: null,
    attireComplement: null,
    attireComplementHex: null,
    attireNotes: null,
    attirePhotos: [],
    topic: null,
    scriptures: [],
    holyTalksNotes: null,
  };
}

/**
 * Ensure every recurring series is materialized through the rolling 4-week
 * horizon. Called on event reads: as occurrences pass, later cadence slots that
 * fall within [today, today + 28 days) are created, so the window always shows
 * the same span ahead (weekly → 4, biweekly → 2, monthly → 1). Idempotent —
 * relies on the @@unique([seriesId, date]) constraint via createMany
 * skipDuplicates, so concurrent calls can't double-create a slot.
 */
export async function ensureRecurringWindow(): Promise<void> {
  const today = startOfToday();
  const horizonEnd = seriesHorizonEnd(today);

  const recurring = await prisma.event.findMany({
    where: { seriesId: { not: null } },
    orderBy: { date: 'asc' },
  });
  if (recurring.length === 0) return;

  // Dates a leader deleted on purpose — never re-create these. Only future ones
  // matter (past slots are skipped anyway), so keep the lookup small.
  const skips = await prisma.seriesSkip.findMany({ where: { date: { gte: today } } });
  const skipped = new Set(skips.map((s) => `${s.seriesId}|${s.date.getTime()}`));

  const bySeries = new Map<string, Event[]>();
  for (const e of recurring) {
    const arr = bySeries.get(e.seriesId!) ?? [];
    arr.push(e);
    bySeries.set(e.seriesId!, arr);
  }

  const toCreate: Prisma.EventCreateManyInput[] = [];
  for (const events of bySeries.values()) {
    const anchor = events[events.length - 1]; // latest (sorted asc)
    if (anchor.repeats === 'once') continue; // defensive — series shouldn't be `once`

    const cursor = new Date(anchor.date);
    for (let i = 0; i < MAX_STEPS; i++) {
      stepDate(cursor, anchor.repeats);
      if (cursor >= horizonEnd) break; // reached the edge of the window
      // Materialize future slots inside the horizon, except dates a leader
      // intentionally deleted (past slots are skipped regardless).
      if (cursor >= today && !skipped.has(`${anchor.seriesId}|${cursor.getTime()}`)) {
        toCreate.push(occurrenceFromAnchor(anchor, new Date(cursor)));
      }
    }
  }

  if (toCreate.length) {
    await prisma.event.createMany({ data: toCreate, skipDuplicates: true });
  }
}
