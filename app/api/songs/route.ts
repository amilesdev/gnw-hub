import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { revalidateSetlists } from '@/lib/cache-tags';
import type { LibrarySongDTO, LyricChart } from '@/lib/setlist-serialize';
import type { Song } from '@prisma/client';

// Shape a library Song (+ its setlist-usage count) into the wire DTO.
function toLibraryDTO(s: Song, usageCount: number): LibrarySongDTO {
  return {
    id: s.id,
    songTitle: s.songTitle,
    artist: s.artist,
    youtubeLink: s.youtubeLink,
    audioSoprano: s.audioSoprano,
    audioAlto: s.audioAlto,
    audioTenor: s.audioTenor,
    audioAllParts: s.audioAllParts,
    arrangementAudio: s.arrangementAudio,
    songKey: s.songKey,
    bpm: s.bpm,
    lyricChart: (s.lyricChart as LyricChart | null) ?? null,
    lyricDocUrl: s.lyricDocUrl,
    lyricChartUpdatedAt: s.lyricChartUpdatedAt?.toISOString() ?? null,
    usageCount,
    updatedAt: s.updatedAt.toISOString(),
  };
}

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

  const library = songs.map((s) => toLibraryDTO(s, s._count.setlistSongs));
  return NextResponse.json({ songs: library });
}

const createSchema = z.object({
  songTitle: z.string().min(1, 'Song title required').max(200),
  artist: z.string().max(200).optional().nullable(),
  youtubeLink: z.string().optional().nullable(),
});

// POST /api/songs — add a new song to the library (no setlist attached). Leader only.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const d = parsed.data;

  const song = await prisma.song.create({
    data: {
      songTitle: d.songTitle,
      artist: d.artist || null,
      youtubeLink: d.youtubeLink || null,
    },
  });

  revalidateSetlists();
  return NextResponse.json({ song: toLibraryDTO(song, 0) }, { status: 201 });
}
