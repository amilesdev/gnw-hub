import type { Song } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AUDIO_PARTS } from '@/lib/setlist-serialize';
import { deleteObjects, pathFromPublicUrl } from '@/lib/supabase';

// A song's uploaded files: the four vocal parts plus the band arrangement.
export const SONG_FILE_FIELDS = [...AUDIO_PARTS, 'arrangementAudio'] as const;
type SongFileField = (typeof SONG_FILE_FIELDS)[number];

/** Every uploaded file URL a song holds. */
export function songFileUrls(song: Pick<Song, SongFileField>): string[] {
  return SONG_FILE_FIELDS.map((f) => song[f]).filter((u): u is string => !!u);
}

/**
 * Delete these song files from storage — except any another song still points
 * at. Copying a song between the Song Library and the Crossover list shares its
 * audio rather than duplicating it, so retiring or replacing one copy must not
 * pull the file out from under the other.
 */
export async function deleteSongFiles(urls: string[], exceptSongId: string): Promise<void> {
  const unique = [...new Set(urls)];
  if (!unique.length) return;
  const others = await prisma.song.findMany({
    where: { id: { not: exceptSongId }, OR: SONG_FILE_FIELDS.map((f) => ({ [f]: { in: unique } })) },
    select: Object.fromEntries(SONG_FILE_FIELDS.map((f) => [f, true])) as Record<SongFileField, true>,
  });
  const stillUsed = new Set(others.flatMap(songFileUrls));
  const paths = unique
    .filter((u) => !stillUsed.has(u))
    .map(pathFromPublicUrl)
    .filter((p): p is string => !!p);
  if (paths.length) await deleteObjects(paths);
}
