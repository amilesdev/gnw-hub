import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCrossover } from '@/lib/crossover-guard';
import { lookInclude, notifyReviewers, serializeLook } from '@/lib/crossover-attire';
import { isOwnLookPath } from '@/lib/upload-path';
import { deleteObjects, pathFromPublicUrl } from '@/lib/supabase';

const schema = z.object({
  photos: z.array(z.string().url()).min(1, 'Add at least one photo of your look').max(6),
  note: z.string().trim().max(500).nullable().optional(),
});

// PUT /api/crossover/looks/mine { photos, note? } — submit (or resubmit) your
// look for this season. A resubmission updates the same look and puts it back
// in the review queue, clearing the last review. Pushes the reviewer.
export async function PUT(req: Request) {
  const guard = await requireCrossover();
  if ('error' in guard) return guard.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { photos, note } = parsed.data;
  const me = guard.user;

  // Only photos uploaded into your own looks/ folder can be on your look.
  if (!photos.every((u) => isOwnLookPath(pathFromPublicUrl(u) ?? '', me.id))) {
    return NextResponse.json({ error: 'Those photos need to be uploaded from this screen.' }, { status: 400 });
  }

  const where = { seasonId_userId: { seasonId: guard.season.id, userId: me.id } };
  const existing = await prisma.crossoverLook.findUnique({ where });
  const review = { status: 'pending' as const, reviewNote: null, reviewedById: null, reviewedByName: null, reviewedAt: null };
  const look = await prisma.crossoverLook.upsert({
    where,
    create: { seasonId: guard.season.id, userId: me.id, photos, note: note || null },
    update: { photos, note: note || null, submittedAt: new Date(), ...review },
    include: lookInclude,
  });

  if (existing) {
    const removed = existing.photos.filter((u) => !photos.includes(u));
    const paths = removed.map(pathFromPublicUrl).filter((p): p is string => !!p);
    if (paths.length) await deleteObjects(paths);
  }

  await notifyReviewers(me.name ?? 'A member', !!existing);
  return NextResponse.json({ look: serializeLook(look) });
}

// DELETE /api/crossover/looks/mine — withdraw your look (and its photos).
export async function DELETE() {
  const guard = await requireCrossover();
  if ('error' in guard) return guard.error;
  const where = { seasonId_userId: { seasonId: guard.season.id, userId: guard.user.id } };
  const existing = await prisma.crossoverLook.findUnique({ where });
  if (!existing) return NextResponse.json({ ok: true });

  const paths = existing.photos.map(pathFromPublicUrl).filter((p): p is string => !!p);
  if (paths.length) await deleteObjects(paths);
  await prisma.crossoverLook.delete({ where });
  return NextResponse.json({ ok: true });
}
