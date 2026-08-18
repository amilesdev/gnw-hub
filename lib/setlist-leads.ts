import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * The song-leader ids a setlist write may carry, per song. Several people can
 * lead one song (co-leads), so it's a list; omitting it entirely on PATCH means
 * "leave this song's leads alone" (distinct from `[]`, which clears them).
 */
export const leadUserIdsSchema = z.array(z.string().min(1)).max(10).optional();

/** Drop duplicate ids, keeping first-seen order. */
export function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Check every lead id across a setlist payload in one query, before the write
 * transaction opens — a stale id would otherwise blow up mid-transaction as a
 * foreign-key error the leader can't act on.
 *
 * Returns true when all ids are real users (an empty list trivially passes).
 */
export async function leadsExist(songs: { leadUserIds?: string[] }[]): Promise<boolean> {
  const ids = dedupe(songs.flatMap((s) => s.leadUserIds ?? []));
  if (ids.length === 0) return true;
  const found = await prisma.user.count({ where: { id: { in: ids } } });
  return found === ids.length;
}

/**
 * Point one song's leaders at exactly `leadUserIds`, for both the setlist
 * placement (SongLead) and the library song's memory (SongLastLead).
 *
 * - `undefined` → the caller said nothing about leads; nothing changes.
 * - `[]` → the leaders are cleared.
 *
 * `setlistDate` is the setlist's own date (its earliest linked event). The
 * memory only moves when this setlist is at least as recent as the one the
 * memory came from, so fixing up an *older* setlist never clobbers the current
 * suggestion. Runs inside the setlist write transaction.
 */
export async function applyLeads(
  tx: Prisma.TransactionClient,
  {
    setlistSongId,
    songId,
    setlistDate,
    leadUserIds,
  }: { setlistSongId: string; songId: string; setlistDate: Date; leadUserIds?: string[] },
) {
  if (!leadUserIds) return;
  const ids = dedupe(leadUserIds);

  // The live assignment for this setlist.
  await tx.songLead.deleteMany({
    where: { setlistSongId, ...(ids.length ? { userId: { notIn: ids } } : {}) },
  });
  if (ids.length) {
    await tx.songLead.createMany({
      data: ids.map((userId) => ({ setlistSongId, userId })),
      skipDuplicates: true, // whoever was already on this song stays put
    });
  }

  // The library memory. An older setlist may not overwrite a newer one's answer.
  const song = await tx.song.findUnique({ where: { id: songId }, select: { lastLeadAt: true } });
  if (song?.lastLeadAt && song.lastLeadAt > setlistDate) return;

  await tx.songLastLead.deleteMany({
    where: { songId, ...(ids.length ? { userId: { notIn: ids } } : {}) },
  });
  if (ids.length) {
    await tx.songLastLead.createMany({
      data: ids.map((userId) => ({ songId, userId })),
      skipDuplicates: true,
    });
  }
  // Clearing the leaders clears the memory's date too, so the song reads as
  // "never led" rather than remembering an empty set at a real date.
  await tx.song.update({
    where: { id: songId },
    data: { lastLeadAt: ids.length ? setlistDate : null },
  });
}
