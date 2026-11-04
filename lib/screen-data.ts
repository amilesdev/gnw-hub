import { prisma } from '@/lib/prisma';
import { serializeSetlist, setlistInclude, sortSetlistsForListing, type SetlistDTO } from '@/lib/setlist-serialize';
import { serializeEvent, eventInclude, type EventDTO } from '@/lib/serialize';
import { pruneExpiredSetlists } from '@/lib/setlist-cleanup';
import type { Role } from '@prisma/client';
import { ensureRecurringWindow } from '@/lib/recurrence';
import { startOfToday } from '@/lib/dates';
import { ensureCrossoverSeason } from '@/lib/crossover';
import { visibleEvents } from '@/lib/crossover-season';

// Server-side mirrors of the list endpoints, so a page can fetch on the server
// (one round-trip, painted with the loading.tsx skeleton) instead of shipping a
// client component that fetches the same data in a useEffect after it mounts.
// Kept identical to the GET handlers in app/api/setlists and app/api/events —
// including the maintenance side-effects — so first paint matches later refetches.

/** All setlists, newest month first — mirror of GET /api/setlists (no filters). */
export async function getAllSetlists(): Promise<SetlistDTO[]> {
  await pruneExpiredSetlists();
  const setlists = await prisma.setlist.findMany({ include: setlistInclude });
  return sortSetlistsForListing(setlists).map(serializeSetlist);
}

/** Upcoming events from today onward, as this viewer may see them — mirror of GET /api/events?scope=all. */
export async function getAllEvents(role: Role): Promise<EventDTO[]> {
  await ensureCrossoverSeason();
  await ensureRecurringWindow();
  await pruneExpiredSetlists();
  const events = await prisma.event.findMany({
    where: { date: { gte: startOfToday() } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    include: eventInclude,
  });
  return visibleEvents(events.map(serializeEvent), role);
}
