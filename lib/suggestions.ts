import type { SongScope } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendPush } from '@/lib/push';
import { serializeSuggestion, type SongSuggestionDTO } from '@/lib/serialize';

// Suggestions come in two lists that never mix, matching the two song lists:
// the Song Library's, and Crossover's (whose "Add" makes a Crossover-list song).

/** How long a passed-on suggestion is kept before it's deleted (and the song can be suggested again). */
export const DISMISSED_RETENTION_DAYS = 90;

/**
 * Delete suggestions the leaders passed on more than DISMISSED_RETENTION_DAYS
 * ago. Keyed on `updatedAt`, which is the moment of the pass: a dismissed row
 * has no other edit path (reopening or adding it moves it out of `dismissed`).
 * Idempotent and cheap once caught up, so it runs lazily on read — same pattern
 * as pruneExpiredSetlists().
 */
export async function pruneDismissedSuggestions(): Promise<void> {
  const cutoff = new Date(Date.now() - DISMISSED_RETENTION_DAYS * 86_400_000);
  await prisma.songSuggestion.deleteMany({ where: { status: 'dismissed', updatedAt: { lt: cutoff } } });
}

/**
 * The suggestions a viewer may see, newest first — the same rule for members
 * and leaders. Everyone sees open and added ones; a passed-on suggestion is
 * visible only to whoever suggested it (tagged "Dismissed" in My Suggestions).
 * Shared by the page (first paint) and GET /api/suggestions (refetch).
 */
export async function getSuggestions(viewer: { id: string }, scope: SongScope = 'library'): Promise<SongSuggestionDTO[]> {
  await pruneDismissedSuggestions();
  const rows = await prisma.songSuggestion.findMany({
    where: {
      scope,
      OR: [{ status: { in: ['open', 'added'] } }, { status: 'dismissed', suggestedById: viewer.id }],
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return rows.map(serializeSuggestion);
}

/**
 * Why this video can't be suggested again, or null if it's new: it's already
 * in the library, or someone already suggested it (open, added, or passed on
 * within the last DISMISSED_RETENTION_DAYS — older passes are pruned first).
 */
export async function duplicateReason(videoId: string, scope: SongScope = 'library'): Promise<string | null> {
  await pruneDismissedSuggestions();
  const listName = scope === 'crossover' ? 'the Crossover songs' : 'the song library';
  const [song, existing] = await Promise.all([
    // Library links are free text (any URL shape), so match on the id itself.
    prisma.song.findFirst({ where: { scope, youtubeLink: { contains: videoId } }, select: { songTitle: true } }),
    prisma.songSuggestion.findFirst({
      where: { videoId, scope },
      orderBy: { createdAt: 'desc' },
      select: { status: true, suggestedByName: true },
    }),
  ]);
  if (song) return `“${song.songTitle}” is already in ${listName}.`;
  if (!existing) return null;
  if (existing.status === 'added') return `This one was already suggested and added to ${listName}.`;
  if (existing.status === 'dismissed') {
    return `The leaders passed on this one recently. It can be suggested again ${DISMISSED_RETENTION_DAYS} days after that.`;
  }
  return `${existing.suggestedByName.split(' ')[0]} already suggested this one.`;
}

/** Let the leaders know a song came in. Best effort — never fails the save. */
export async function notifyLeadersOfSuggestion(s: SongSuggestionDTO): Promise<void> {
  try {
    const leaders = await prisma.user.findMany({
      // A leader suggesting a song doesn't need to be told about it.
      where: { role: 'leader', status: 'active', ...(s.suggestedById ? { id: { not: s.suggestedById } } : {}) },
      select: { id: true },
    });
    if (leaders.length === 0) return;
    const who = s.suggestedByName.split(' ')[0];
    const crossover = s.scope === 'crossover';
    await sendPush(
      {
        title: crossover ? 'New Crossover song suggestion' : 'New song suggestion',
        body: `${who} suggested “${s.songTitle}”${s.artist ? ` by ${s.artist}` : ''}${crossover ? ' for Crossover' : ''}.`,
        url: crossover ? '/dashboard/crossover/suggestions' : '/dashboard/library/suggestions',
        tag: `suggestion-${s.id}`,
      },
      leaders.map((l) => l.id),
    );
  } catch (err) {
    console.error('[suggestions] leader notify failed:', err);
  }
}
