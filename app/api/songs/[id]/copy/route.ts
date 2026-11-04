import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { revalidateSetlists } from '@/lib/cache-tags';
import { toLibraryDTO } from '@/lib/song-library';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ to: z.enum(['library', 'crossover']) });

// POST /api/songs/[id]/copy { to } — copy a song into the other list: "Import
// from library" (→ crossover) or "Copy to Song Library" (→ library). The copy
// is a separate song from then on, so editing one never changes the other; it
// shares the original's audio files, which song-file cleanup accounts for.
// Leader only.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Pick a list to copy to.' }, { status: 400 });
  const { to } = parsed.data;

  const source = await prisma.song.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: 'Song not found' }, { status: 404 });
  if (source.scope === to) {
    return NextResponse.json({ error: 'That song is already in this list.' }, { status: 400 });
  }

  const song = await prisma.song.create({
    data: {
      scope: to,
      songTitle: source.songTitle,
      artist: source.artist,
      youtubeLink: source.youtubeLink,
      audioSoprano: source.audioSoprano,
      audioAlto: source.audioAlto,
      audioTenor: source.audioTenor,
      audioAllParts: source.audioAllParts,
      arrangementAudio: source.arrangementAudio,
      songKey: source.songKey,
      bpm: source.bpm,
      lyricChart: source.lyricChart ?? Prisma.DbNull,
      lyricDocUrl: source.lyricDocUrl,
      lyricChartUpdatedAt: source.lyricChartUpdatedAt,
    },
  });

  revalidateSetlists();
  return NextResponse.json({ song: toLibraryDTO(song) }, { status: 201 });
}
