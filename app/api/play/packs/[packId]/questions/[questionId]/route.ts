import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePackOwner, isPackLocked } from '@/lib/play/packs';

type Ctx = { params: Promise<{ packId: string; questionId: string }> };

// DELETE /api/play/packs/[packId]/questions/[questionId] — remove one question.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { packId, questionId } = await params;
  const guard = await requirePackOwner(packId);
  if ('error' in guard) return guard.error;
  if (await isPackLocked(packId)) {
    return NextResponse.json({ error: 'Pack is locked during a live game' }, { status: 409 });
  }

  await prisma.question.deleteMany({ where: { id: questionId, packId } });
  await prisma.questionPack.update({ where: { id: packId }, data: { updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
