import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCrossover } from '@/lib/crossover-guard';
import { getSeasonSets } from '@/lib/crossover-sets';
import { assignmentsSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1, 'Give the set a name').max(80).optional(),
  minutes: z.number().int().min(0).max(240).nullable().optional(),
  // The set's songs in order (Crossover-list songs only). Replaces the set's songs.
  songIds: z
    .array(z.string().min(1))
    .max(40)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'A song can only be in a set once.' })
    .optional(),
  // Who sings on the set and which part. Replaces the set's singers.
  singers: assignmentsSchema.optional(),
});

async function ownedSet(id: string, seasonId: string) {
  return prisma.crossoverSet.findFirst({ where: { id, seasonId } });
}

// PATCH /api/crossover/sets/[id] — rename, set the planned length, or replace
// the songs and/or singers. Leader only.
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireCrossover({ leader: true });
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!(await ownedSet(id, guard.season.id))) return NextResponse.json({ error: 'Set not found' }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const d = parsed.data;

  if (d.songIds?.length) {
    const ok = await prisma.song.count({ where: { id: { in: d.songIds }, scope: 'crossover' } });
    if (ok !== d.songIds.length) {
      return NextResponse.json({ error: 'Sets can only use songs from the Crossover song list.' }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (d.name !== undefined || d.minutes !== undefined) {
      await tx.crossoverSet.update({
        where: { id },
        data: {
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.minutes !== undefined ? { minutes: d.minutes } : {}),
        },
      });
    }
    if (d.songIds) {
      await tx.crossoverSetSong.deleteMany({ where: { setId: id } });
      if (d.songIds.length) {
        await tx.crossoverSetSong.createMany({ data: d.songIds.map((songId, position) => ({ setId: id, songId, position })) });
      }
    }
    if (d.singers) {
      await tx.crossoverSetSinger.deleteMany({ where: { setId: id } });
      if (d.singers.length) {
        await tx.crossoverSetSinger.createMany({ data: d.singers.map((s) => ({ setId: id, userId: s.userId, part: s.part })) });
      }
    }
  });

  return NextResponse.json({ sets: await getSeasonSets(guard.season) });
}

// DELETE /api/crossover/sets/[id] — remove a set (its song placements and
// singers go with it; the songs stay in the Crossover list). Leader only.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireCrossover({ leader: true });
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!(await ownedSet(id, guard.season.id))) return NextResponse.json({ error: 'Set not found' }, { status: 404 });

  await prisma.crossoverSet.delete({ where: { id } });
  return NextResponse.json({ sets: await getSeasonSets(guard.season) });
}
