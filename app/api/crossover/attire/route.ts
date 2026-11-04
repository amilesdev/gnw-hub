import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCrossover } from '@/lib/crossover-guard';
import { getLooks, seasonAttire } from '@/lib/crossover-attire';
import { canReviewLooks } from '@/lib/access';
import { deleteObjects, pathFromPublicUrl } from '@/lib/supabase';

// GET /api/crossover/attire — this season's attire, the viewer's own look, and
// the looks they may see.
export async function GET() {
  const guard = await requireCrossover();
  if ('error' in guard) return guard.error;
  const { mine, looks } = await getLooks(guard.season.id, guard.user);
  return NextResponse.json({
    attire: seasonAttire(guard.season),
    mine,
    looks,
    canReview: canReviewLooks(guard.user),
  });
}

const hex = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a hex value like #D4AF37')
  .nullable()
  .optional();
const text = (max: number) => z.string().trim().max(max).nullable().optional();

const patchSchema = z.object({
  attirePrimary: text(120),
  attirePrimaryHex: hex,
  attireSecondary: text(120),
  attireSecondaryHex: hex,
  attireComplement: text(120),
  attireComplementHex: hex,
  attireNotes: text(1000),
  attirePhotos: z.array(z.string().url()).max(12).optional(),
});

// PATCH /api/crossover/attire — set the season's attire. Leader only. Reference
// photos that were removed are deleted from storage.
export async function PATCH(req: Request) {
  const guard = await requireCrossover({ leader: true });
  if ('error' in guard) return guard.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const d = parsed.data;

  const data = Object.fromEntries(
    Object.entries(d)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === 'string' ? v || null : v]),
  );

  if (d.attirePhotos) {
    const removed = guard.season.attirePhotos.filter((u) => !d.attirePhotos!.includes(u));
    const paths = removed.map(pathFromPublicUrl).filter((p): p is string => !!p);
    if (paths.length) await deleteObjects(paths);
  }

  const season = await prisma.crossoverSeason.update({ where: { id: guard.season.id }, data });
  return NextResponse.json({ attire: seasonAttire(season) });
}
