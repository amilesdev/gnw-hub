import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { serializeSetlist, setlistInclude } from '@/lib/setlist-serialize';
import { monthKey } from '@/lib/dates';
import { revalidateSetlists } from '@/lib/cache-tags';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const { id } = await params;
  const setlist = await prisma.setlist.findUnique({ where: { id }, include: setlistInclude });
  if (!setlist) return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });
  return NextResponse.json({ setlist: serializeSetlist(setlist) });
}

const patchSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  eventIds: z.array(z.string().min(1)).min(1, 'Pick at least one event').optional(),
  songs: z
    .array(
      z.object({
        id: z.string().optional(),
        songTitle: z.string().min(1).max(200),
        artist: z.string().max(200).optional().nullable(),
        youtubeLink: z.string().optional().nullable(),
        driveLink: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

// PATCH /api/setlists/[id] — update month/events and reconcile songs (incl. reorder). Leader only.
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.setlist.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { name, eventIds, songs } = parsed.data;

  // Re-linking events re-derives the setlist's month from the earliest one.
  let nextMonth: string | undefined;
  if (eventIds) {
    const events = await prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, date: true, setlistId: true },
    });
    if (events.length !== eventIds.length) {
      return NextResponse.json({ error: 'One or more events not found' }, { status: 404 });
    }
    // An event linked to a *different* setlist can't be claimed here.
    if (events.some((e) => e.setlistId && e.setlistId !== id)) {
      return NextResponse.json({ error: 'One or more selected events already have a setlist.' }, { status: 409 });
    }
    nextMonth = monthKey(events.reduce((a, b) => (a.date <= b.date ? a : b)).date);
  }

  await prisma.$transaction(async (tx) => {
    if (eventIds || name !== undefined) {
      // `set` replaces the full link set: connects new events, unlinks dropped ones.
      await tx.setlist.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name: name?.trim() || null } : {}),
          ...(eventIds ? { month: nextMonth, events: { set: eventIds.map((eid) => ({ id: eid })) } } : {}),
        },
      });
    }

    if (songs) {
      // Songs are library rows now. Removing a song from a setlist drops only the
      // *link* (SetlistSong) — the library Song and its audio in storage persist,
      // so they're still available to other setlists and re-usable next time.
      const keepSongIds = songs.filter((s) => s.id).map((s) => s.id!);
      await tx.setlistSong.deleteMany({
        where: { setlistId: id, ...(keepSongIds.length ? { songId: { notIn: keepSongIds } } : {}) },
      });

      // Reconcile in order; position = array index.
      for (let i = 0; i < songs.length; i++) {
        const s = songs[i];
        if (s.id) {
          // Existing library song: update its shared fields (propagates to every
          // setlist using it) and (re)place it in this setlist at position i.
          await tx.song.update({
            where: { id: s.id },
            data: { songTitle: s.songTitle, artist: s.artist || null, youtubeLink: s.youtubeLink || null, driveLink: s.driveLink || null },
          });
          await tx.setlistSong.upsert({
            where: { setlistId_songId: { setlistId: id, songId: s.id } },
            create: { setlistId: id, songId: s.id, position: i },
            update: { position: i },
          });
        } else {
          // New song: add it to the library and link it in.
          await tx.setlistSong.create({
            data: {
              setlist: { connect: { id } },
              position: i,
              song: { create: { songTitle: s.songTitle, artist: s.artist || null, youtubeLink: s.youtubeLink || null, driveLink: s.driveLink || null } },
            },
          });
        }
      }
    }
  });

  const updated = await prisma.setlist.findUnique({ where: { id }, include: setlistInclude });
  revalidateSetlists();
  return NextResponse.json({ setlist: serializeSetlist(updated!) });
}

// DELETE /api/setlists/[id] — delete the setlist. Leader only.
// Only the song *links* (SetlistSong) cascade away; the library Songs and their
// audio in storage stay put, ready for the next setlist. Freeing a song's files
// is a separate, deliberate "retire from library" action.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.setlist.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });

  await prisma.setlist.delete({ where: { id } }); // SetlistSong links cascade
  revalidateSetlists();
  return NextResponse.json({ ok: true });
}
