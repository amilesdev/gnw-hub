import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import type { LyricChart } from '@/lib/setlist-serialize';

// A library song as shown on the Song Library screen: the reusable content plus
// how many setlists currently use it (so a leader can tell what's in rotation vs.
// safe to retire). Audio URLs are included so the library can play/edit parts
// directly, without going through a setlist.
export type LibrarySongDTO = {
  id: string;
  songTitle: string;
  artist: string | null;
  youtubeLink: string | null;
  driveLink: string | null;
  audioSoprano: string | null;
  audioAlto: string | null;
  audioTenor: string | null;
  audioAllParts: string | null;
  lyricChart: LyricChart | null;
  lyricDocUrl: string | null;
  lyricChartUpdatedAt: string | null;
  usageCount: number; // number of setlists that reference this song
  updatedAt: string;
};

// GET /api/songs?q=...  — the song library, title A→Z. Any active user may browse.
export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const q = new URL(req.url).searchParams.get('q')?.trim();
  const songs = await prisma.song.findMany({
    where: q
      ? {
          OR: [
            { songTitle: { contains: q, mode: 'insensitive' } },
            { artist: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { songTitle: 'asc' },
    include: { _count: { select: { setlistSongs: true } } },
  });

  const library: LibrarySongDTO[] = songs.map((s) => ({
    id: s.id,
    songTitle: s.songTitle,
    artist: s.artist,
    youtubeLink: s.youtubeLink,
    driveLink: s.driveLink,
    audioSoprano: s.audioSoprano,
    audioAlto: s.audioAlto,
    audioTenor: s.audioTenor,
    audioAllParts: s.audioAllParts,
    lyricChart: (s.lyricChart as LyricChart | null) ?? null,
    lyricDocUrl: s.lyricDocUrl,
    lyricChartUpdatedAt: s.lyricChartUpdatedAt?.toISOString() ?? null,
    usageCount: s._count.setlistSongs,
    updatedAt: s.updatedAt.toISOString(),
  }));

  return NextResponse.json({ songs: library });
}
