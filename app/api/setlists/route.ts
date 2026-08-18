import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { serializeSetlist, setlistInclude, sortSetlistsForListing } from '@/lib/setlist-serialize';
import { pruneExpiredSetlists } from '@/lib/setlist-cleanup';
import { leadUserIdsSchema, leadsExist, applyLeads } from '@/lib/setlist-leads';
import { monthKey } from '@/lib/dates';
import { revalidateSetlists } from '@/lib/cache-tags';

// GET /api/setlists?month=YYYY-MM&eventId=...  (omit filters → all, newest month first)
export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  // Sweep away setlists whose linked events have all passed before listing.
  await pruneExpiredSetlists();

  const params = new URL(req.url).searchParams;
  const month = params.get('month');
  const eventId = params.get('eventId');
  const setlists = await prisma.setlist.findMany({
    where: {
      ...(month ? { month } : {}),
      ...(eventId ? { events: { some: { id: eventId } } } : {}),
    },
    include: setlistInclude,
  });

  return NextResponse.json({ setlists: sortSetlistsForListing(setlists).map(serializeSetlist) });
}

const createSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  eventIds: z.array(z.string().min(1)).min(1, 'Pick at least one event'),
  songs: z
    .array(
      z.object({
        // Present → link this existing library song; absent → create a new one.
        id: z.string().optional(),
        songTitle: z.string().min(1).max(200),
        artist: z.string().max(200).optional().nullable(),
        youtubeLink: z.string().optional().nullable(),
        // Who leads this song on this setlist.
        leadUserIds: leadUserIdsSchema,
      }),
    )
    .default([]),
});

// POST /api/setlists — create a setlist for a single event with ordered songs. Leader only.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { name, eventIds, songs } = parsed.data;

  const events = await prisma.event.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, date: true, setlistId: true },
  });
  if (events.length !== eventIds.length) {
    return NextResponse.json({ error: 'One or more events not found' }, { status: 404 });
  }
  if (events.some((e) => e.setlistId)) {
    return NextResponse.json({ error: 'One or more selected events already have a setlist.' }, { status: 409 });
  }
  if (!(await leadsExist(songs))) {
    return NextResponse.json({ error: 'One or more song leaders no longer exist.' }, { status: 404 });
  }

  // Month groups the setlist under its earliest linked event.
  const earliest = events.reduce((a, b) => (a.date <= b.date ? a : b));

  const setlist = await prisma.$transaction(async (tx) => {
    const created = await tx.setlist.create({
      data: {
        name: name?.trim() || null,
        month: monthKey(earliest.date),
        events: { connect: eventIds.map((id) => ({ id })) },
        // Each song is either linked from the library (id present) or created
        // fresh in the library and linked in — both at its position in the order.
        songs: {
          create: songs.map((s, i) => ({
            position: i,
            song: s.id
              ? { connect: { id: s.id } }
              : {
                  create: {
                    songTitle: s.songTitle,
                    artist: s.artist || null,
                    youtubeLink: s.youtubeLink || null,
                  },
                },
          })),
        },
      },
      include: { songs: { orderBy: { position: 'asc' } } },
    });

    // Leaders go on afterwards rather than nested in the create above: a
    // brand-new song's library id only exists once the row is written, and the
    // "who led it last" memory is keyed on it.
    for (const link of created.songs) {
      await applyLeads(tx, {
        setlistSongId: link.id,
        songId: link.songId,
        setlistDate: earliest.date,
        leadUserIds: songs[link.position]?.leadUserIds,
      });
    }

    return tx.setlist.findUniqueOrThrow({ where: { id: created.id }, include: setlistInclude });
  });

  revalidateSetlists();
  return NextResponse.json({ setlist: serializeSetlist(setlist) }, { status: 201 });
}
