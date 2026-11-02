import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { revalidateSetlists } from '@/lib/cache-tags';
import { suggestionToLibrarySchema } from '@/lib/validation';
import { serializeSuggestion } from '@/lib/serialize';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/suggestions/[id]/library — turn a suggestion into a library Song
// (title, artist, YouTube link) and mark it added. Leader only. Vocal parts,
// charts, and band content are filled in from the library as usual afterwards.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = suggestionToLibrarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.songSuggestion.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
  if (existing.status === 'added') {
    return NextResponse.json({ error: 'This one is already in the library.' }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const song = await tx.song.create({
      data: { songTitle: d.songTitle, artist: d.artist || null, youtubeLink: existing.url },
    });
    return tx.songSuggestion.update({
      where: { id },
      data: { status: 'added', songId: song.id, songTitle: d.songTitle, artist: d.artist || null },
    });
  });

  revalidateSetlists();
  return NextResponse.json({ suggestion: serializeSuggestion(updated) });
}
