import type { Event, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { firstSlotIndexOnOrAfter, seriesHorizonEnd, seriesSlot, startOfToday, stepDate } from '@/lib/dates';
import { seasonEnd, seasonYearForDate } from '@/lib/crossover-season';

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
    seriesStart: anchor.seriesStart,
    crossoverKind: anchor.crossoverKind,
    crossoverSeasonId: anchor.crossoverSeasonId,
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

  // Only the latest (anchor) occurrence of each series is needed to extend the
  // window, so ask the DB for the max date per series instead of loading every
  // historical occurrence. This scales with the number of series, not the total
  // number of past events. The @@unique([seriesId, date]) constraint guarantees
  // each (seriesId, maxDate) pair resolves to exactly one row.
  const groups = await prisma.event.groupBy({
    by: ['seriesId'],
    where: { seriesId: { not: null } },
    _max: { date: true },
  });
  if (groups.length === 0) return;

  const anchorKeys = groups
    .filter(
      (g): g is typeof g & { seriesId: string; _max: { date: Date } } => !!g.seriesId && !!g._max.date,
    )
    .map((g) => ({ seriesId: g.seriesId, date: g._max.date }));
  if (anchorKeys.length === 0) return;

  const anchors = await prisma.event.findMany({ where: { OR: anchorKeys } });

  // Dates a leader deleted on purpose — never re-create these. Only future ones
  // matter (past slots are skipped anyway), so keep the lookup small.
  const skips = await prisma.seriesSkip.findMany({ where: { date: { gte: today } } });
  const skipped = new Set(skips.map((s) => `${s.seriesId}|${s.date.getTime()}`));

  const toCreate: Prisma.EventCreateManyInput[] = [];
  for (const anchor of anchors) {
    if (anchor.repeats === 'once') continue; // defensive — series shouldn't be `once`

    // A Crossover series (e.g. weekly GNW rehearsals) ends with its season on Dec 31.
    const seasonYear = anchor.crossoverKind ? seasonYearForDate(anchor.date) : null;
    const lastDate = seasonYear != null ? seasonEnd(seasonYear) : null;

    const isSkipped = (d: Date) => skipped.has(`${anchor.seriesId}|${d.getTime()}`);

    if (anchor.seriesStart) {
      // Slots come from the series' start, never from another occurrence, so a
      // moved or deleted occurrence can't shift the schedule. Every slot in
      // [today, horizon) is offered: ones that already exist are dropped by
      // skipDuplicates, and ones vacated on purpose (deleted, or moved away —
      // PATCH records those) are in SeriesSkip.
      const start = anchor.seriesStart;
      for (let k = firstSlotIndexOnOrAfter(start, anchor.repeats, today), i = 0; i < MAX_STEPS; k++, i++) {
        const slot = seriesSlot(start, anchor.repeats, k);
        if (slot >= horizonEnd) break; // reached the edge of the window
        if (lastDate && slot > lastDate) break; // the Crossover season is over
        if (!isSkipped(slot)) toCreate.push(occurrenceFromAnchor(anchor, slot));
      }
      continue;
    }

    // Legacy series (created before `seriesStart`): step from the latest
    // occurrence, as before, so they keep the dates the team already sees.
    const cursor = new Date(anchor.date);
    for (let i = 0; i < MAX_STEPS; i++) {
      stepDate(cursor, anchor.repeats);
      if (cursor >= horizonEnd) break; // reached the edge of the window
      if (lastDate && cursor > lastDate) break; // the Crossover season is over
      // Materialize future slots inside the horizon, except dates a leader
      // intentionally deleted (past slots are skipped regardless).
      if (cursor >= today && !isSkipped(cursor)) {
        toCreate.push(occurrenceFromAnchor(anchor, new Date(cursor)));
      }
    }
  }

  if (toCreate.length) {
    await prisma.event.createMany({ data: toCreate, skipDuplicates: true });
  }
}
