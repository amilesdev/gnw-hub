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

  // Scope the id to this pack before touching anything: the answer sweep below
  // keys off questionId alone, so a mismatched id must not reach it.
  const question = await prisma.question.findFirst({
    where: { id: questionId, packId },
    select: { id: true },
  });

  if (question) {
    // GameAnswer.questionId is RESTRICT, so a question anyone has ever answered
    // can't be dropped while those rows stand. isPackLocked above already ruled
    // out live games, so every answer here belongs to a finished one — clear
    // them with the question, exactly as deleting a whole pack clears its
    // sessions. Past games recompute without this question; Play Points are
    // stored on the User and are unaffected.
    await prisma.$transaction([
      prisma.gameAnswer.deleteMany({ where: { questionId: question.id } }),
      prisma.question.delete({ where: { id: question.id } }),
    ]);
  }

  await prisma.questionPack.update({ where: { id: packId }, data: { updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
