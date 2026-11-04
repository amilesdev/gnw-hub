import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCrossover } from '@/lib/crossover-guard';
import { canReviewLooks } from '@/lib/access';
import { lookInclude, notifyMember, serializeLook } from '@/lib/crossover-attire';

type Ctx = { params: Promise<{ id: string }> };

const schema = z
  .object({
    status: z.enum(['approved', 'changes_requested']),
    reviewNote: z.string().trim().max(500).nullable().optional(),
  })
  .refine((d) => d.status === 'approved' || !!d.reviewNote, {
    message: 'Say what should change.',
    path: ['reviewNote'],
  });

// PATCH /api/crossover/looks/[id] { status, reviewNote? } — approve a look, or
// send it back with a note. The attire reviewer only. Pushes the member.
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireCrossover();
  if ('error' in guard) return guard.error;
  if (!canReviewLooks(guard.user)) return NextResponse.json({ error: 'Only the attire reviewer can review looks.' }, { status: 403 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const existing = await prisma.crossoverLook.findFirst({
    where: { id, seasonId: guard.season.id },
    include: { user: { select: { role: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Look not found' }, { status: 404 });

  const reviewerName = guard.user.name ?? 'The reviewer';
  const look = await prisma.crossoverLook.update({
    where: { id },
    data: {
      status: parsed.data.status,
      reviewNote: parsed.data.reviewNote || null,
      reviewedById: guard.user.id,
      reviewedByName: reviewerName,
      reviewedAt: new Date(),
    },
    include: lookInclude,
  });

  await notifyMember(existing.userId, existing.user.role, parsed.data.status, reviewerName.split(' ')[0]);
  return NextResponse.json({ look: serializeLook(look) });
}
