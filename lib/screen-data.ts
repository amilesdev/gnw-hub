import { prisma } from '@/lib/prisma';
import { serializeSetlist, setlistInclude, type SetlistDTO } from '@/lib/setlist-serialize';
import { serializeEvent, eventInclude, type EventDTO } from '@/lib/serialize';
import { pruneExpiredSetlists } from '@/lib/setlist-cleanup';
import { ensureRecurringWindow } from '@/lib/recurrence';
import { startOfToday } from '@/lib/dates';

// Server-side mirrors of the list endpoints, so a page can fetch on the server
// (one round-trip, painted with the loading.tsx skeleton) instead of shipping a
// client component that fetches the same data in a useEffect after it mounts.
// Kept identical to the GET handlers in app/api/setlists and app/api/events —
// including the maintenance side-effects — so first paint matches later refetches.

/** All setlists, newest month first — mirror of GET /api/setlists (no filters). */
export async function getAllSetlists(): Promise<SetlistDTO[]> {
  await pruneExpiredSetlists();
  const setlists = await prisma.setlist.findMany({
    include: setlistInclude,
    orderBy: [{ month: 'desc' }, { createdAt: 'asc' }],
  });
  return setlists.map(serializeSetlist);
}

/** Upcoming events from today onward — mirror of GET /api/events?scope=all. */
export async function getAllEvents(): Promise<EventDTO[]> {
  await ensureRecurringWindow();
  await pruneExpiredSetlists();
  const events = await prisma.event.findMany({
    where: { date: { gte: startOfToday() } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    include: eventInclude,
  });
  return events.map(serializeEvent);
}
