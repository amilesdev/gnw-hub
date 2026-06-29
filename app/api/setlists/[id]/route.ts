import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { serializeSetlist, AUDIO_PARTS } from '@/lib/setlist-serialize';
import { deleteObjects, pathFromPublicUrl } from '@/lib/supabase';
import { monthKey } from '@/lib/dates';
import type { Song } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

const setlistInclude = {
  songs: true,
  events: { select: { id: true, eventName: true, date: true, time: true } },
} as const;

function audioPathsOf(song: Song): string[] {
  return AUDIO_PARTS.map((p) => song[p])
    .filter((u): u is string => !!u)
    .map(pathFromPublicUrl)
    .filter((p): p is string => !!p);
}

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

  const existing = await prisma.setlist.findUnique({ where: { id }, include: { songs: true } });
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
      const keepIds = new Set(songs.filter((s) => s.id).map((s) => s.id!));
      // Delete removed songs (and their audio from storage).
      const removed = existing.songs.filter((s) => !keepIds.has(s.id));
      const paths = removed.flatMap(audioPathsOf);
      if (paths.length) await deleteObjects(paths);
      if (removed.length) {
        await tx.song.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
      }

      // Upsert in order; position = array index. Audio fields untouched here.
      for (let i = 0; i < songs.length; i++) {
        const s = songs[i];
        if (s.id) {
          await tx.song.update({
            where: { id: s.id },
            data: { position: i, songTitle: s.songTitle, artist: s.artist || null, youtubeLink: s.youtubeLink || null, driveLink: s.driveLink || null },
          });
        } else {
          await tx.song.create({
            data: { setlistId: id, position: i, songTitle: s.songTitle, artist: s.artist || null, youtubeLink: s.youtubeLink || null, driveLink: s.driveLink || null },
          });
        }
      }
    }
  });

  const updated = await prisma.setlist.findUnique({ where: { id }, include: setlistInclude });
  return NextResponse.json({ setlist: serializeSetlist(updated!) });
}

// DELETE /api/setlists/[id] — delete setlist + all song audio in storage. Leader only.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.setlist.findUnique({ where: { id }, include: { songs: true } });
  if (!existing) return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });

  const paths = existing.songs.flatMap(audioPathsOf);
  if (paths.length) await deleteObjects(paths);

  await prisma.setlist.delete({ where: { id } }); // songs cascade
  return NextResponse.json({ ok: true });
}
