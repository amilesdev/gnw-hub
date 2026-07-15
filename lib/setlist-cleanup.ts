import { prisma } from '@/lib/prisma';
import { startOfToday } from '@/lib/dates';

/**
 * Auto-delete setlists whose linked events have all passed.
 *
 * A setlist can be shared by several events (e.g. a rehearsal on the 1st and the
 * service it leads into on the 4th). It survives until the *last* of those
 * events is in the past — i.e. until it has no linked event dated today or
 * later. A setlist left with no events at all (its events were deleted) counts
 * as expired too, so it's swept up here.
 *
 * Songs are library rows now, so an expiring setlist only takes its SetlistSong
 * links with it (they cascade) — the library Songs and their audio in storage
 * persist for reuse. Idempotent and cheap once caught up (the filter matches
 * nothing), so it's safe to run lazily on read alongside ensureRecurringWindow().
 */
export async function pruneExpiredSetlists(): Promise<void> {
  await prisma.setlist.deleteMany({
    where: { events: { none: { date: { gte: startOfToday() } } } },
  });
}
