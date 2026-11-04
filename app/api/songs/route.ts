import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { revalidateSetlists } from '@/lib/cache-tags';
import { libraryInclude, toLibraryDTO } from '@/lib/song-library';
import { crossoverOpenFor } from '@/lib/crossover-season';

const scopeEnum = z.enum(['library', 'crossover']);

// GET /api/songs?q=...&scope=library|crossover — a song list, title A→Z. Any
// active user may browse the Song Library; the Crossover list (its own songs,
// never mixed in) follows the Crossover season's visibility.
export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const url = new URL(req.url);
  const scope = scopeEnum.catch('library').parse(url.searchParams.get('scope') ?? 'library');
  if (scope === 'crossover' && !crossoverOpenFor(guard.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const q = url.searchParams.get('q')?.trim();
  const songs = await prisma.song.findMany({
    where: {
      scope,
      ...(q
        ? {
            OR: [
              { songTitle: { contains: q, mode: 'insensitive' } },
              { artist: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { songTitle: 'asc' },
    include: libraryInclude,
  });

  return NextResponse.json({ songs: songs.map(toLibraryDTO) });
}

const createSchema = z.object({
  songTitle: z.string().min(1, 'Song title required').max(200),
  artist: z.string().max(200).optional().nullable(),
  youtubeLink: z.string().optional().nullable(),
  scope: scopeEnum.optional().default('library'),
});

// POST /api/songs — add a new song to the Song Library (or the Crossover list),
// with no setlist attached. Leader only.
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
      scope: d.scope,
    },
  });

  revalidateSetlists();
  return NextResponse.json({ song: toLibraryDTO(song) }, { status: 201 });
}
