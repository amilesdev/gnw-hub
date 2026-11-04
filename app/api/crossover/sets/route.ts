import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCrossover } from '@/lib/crossover-guard';
import { getSeasonSets } from '@/lib/crossover-sets';

// GET /api/crossover/sets — the running season's sets, in order (anyone the
// season is open for).
export async function GET() {
  const guard = await requireCrossover();
  if ('error' in guard) return guard.error;
  return NextResponse.json({ year: guard.season.year, sets: await getSeasonSets(guard.season) });
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Give the set a name').max(80),
  minutes: z.number().int().min(0).max(240).nullable().optional(),
});

// POST /api/crossover/sets { name, minutes? } — add a set at the end. Leader only.
export async function POST(req: Request) {
  const guard = await requireCrossover({ leader: true });
  if ('error' in guard) return guard.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  await getSeasonSets(guard.season); // make sure the default build exists first
  const last = await prisma.crossoverSet.findFirst({
    where: { seasonId: guard.season.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  await prisma.crossoverSet.create({
    data: {
      seasonId: guard.season.id,
      name: parsed.data.name,
      minutes: parsed.data.minutes ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });
  return NextResponse.json({ sets: await getSeasonSets(guard.season) }, { status: 201 });
}

const orderSchema = z.object({ order: z.array(z.string().min(1)).max(50) });

// PATCH /api/crossover/sets { order: setId[] } — reorder the season's sets. Leader only.
export async function PATCH(req: Request) {
  const guard = await requireCrossover({ leader: true });
  if ('error' in guard) return guard.error;
  const parsed = orderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order' }, { status: 400 });

  const ids = parsed.data.order;
  const owned = await prisma.crossoverSet.count({ where: { seasonId: guard.season.id, id: { in: ids } } });
  if (owned !== ids.length) return NextResponse.json({ error: 'Those sets aren’t all in this season.' }, { status: 400 });

  await prisma.$transaction(ids.map((id, position) => prisma.crossoverSet.update({ where: { id }, data: { position } })));
  return NextResponse.json({ sets: await getSeasonSets(guard.season) });
}
