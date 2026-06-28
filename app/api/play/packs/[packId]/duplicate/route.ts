import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePackOwner } from '@/lib/play/packs';

type Ctx = { params: Promise<{ packId: string }> };

// POST /api/play/packs/[packId]/duplicate — deep-copy a pack (name + " Copy")
// with all its questions, and return the new pack id for navigation.
export async function POST(_req: Request, { params }: Ctx) {
  const { packId } = await params;
  const guard = await requirePackOwner(packId);
  if ('error' in guard) return guard.error;

  const questions = await prisma.question.findMany({
    where: { packId },
    orderBy: { orderIndex: 'asc' },
  });

  const copy = await prisma.questionPack.create({
    data: {
      name: `${guard.pack.name} Copy`,
      createdById: guard.userId,
      questions: {
        create: questions.map((q) => ({
          type: q.type,
          questionText: q.questionText,
          options: q.options ?? [],
          correctAnswer: q.correctAnswer,
          orderIndex: q.orderIndex,
        })),
      },
    },
  });

  return NextResponse.json({ id: copy.id }, { status: 201 });
}
