import { prisma } from '@/lib/prisma';
import { startOfToday } from '@/lib/dates';
import { deleteObjects, pathFromPublicUrl } from '@/lib/supabase';
import { AUDIO_PARTS } from '@/lib/setlist-serialize';
import type { Song } from '@prisma/client';

function audioPathsOf(song: Song): string[] {
  return AUDIO_PARTS.map((p) => song[p])
    .filter((u): u is string => !!u)
    .map(pathFromPublicUrl)
    .filter((p): p is string => !!p);
}

/**
 * Auto-delete setlists whose linked events have all passed.
 *
 * A setlist can be shared by several events (e.g. a rehearsal on the 1st and the
 * service it leads into on the 4th). It survives until the *last* of those
 * events is in the past — i.e. until it has no linked event dated today or
 * later. A setlist left with no events at all (its events were deleted) counts
 * as expired too, so it's swept up here.
 *
 * Mirrors the manual DELETE route (app/api/setlists/[id]): song audio in
 * Supabase storage is removed first, then the setlist itself (songs cascade via
 * the schema). Idempotent and cheap once caught up — the filter matches nothing
 * — so it's safe to run lazily on read alongside ensureRecurringWindow().
 */
export async function pruneExpiredSetlists(): Promise<void> {
  const expired = await prisma.setlist.findMany({
    where: { events: { none: { date: { gte: startOfToday() } } } },
    include: { songs: true },
  });
  if (expired.length === 0) return;

  const paths = expired.flatMap((s) => s.songs.flatMap(audioPathsOf));
  if (paths.length) await deleteObjects(paths);

  await prisma.setlist.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } });
}
