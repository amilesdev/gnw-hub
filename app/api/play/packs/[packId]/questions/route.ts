import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePackOwner, isPackLocked, serializeQuestion } from '@/lib/play/packs';
import { questionUpsertSchema } from '@/lib/play/validation';

type Ctx = { params: Promise<{ packId: string }> };

// POST /api/play/packs/[packId]/questions — upsert one question (autosave). An
// empty questionText / unselected correctAnswer is allowed (the builder shows a
// warning dot but doesn't block saving, per spec §2.9).
export async function POST(req: Request, { params }: Ctx) {
  const { packId } = await params;
  const guard = await requirePackOwner(packId);
  if ('error' in guard) return guard.error;
  if (await isPackLocked(packId)) {
    return NextResponse.json({ error: 'Pack is locked during a live game' }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = questionUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { id, type, questionText, options, correctAnswer, orderIndex } = parsed.data;

  // Normalize options: T/F is always exactly ["True","False"].
  const normalizedOptions = type === 'true_false' ? ['True', 'False'] : options;
  // Only persist a correctAnswer that actually matches an option; otherwise keep
  // it empty so the row flags as incomplete.
  const correct = normalizedOptions.includes(correctAnswer) ? correctAnswer : '';

  const data = { type, questionText, options: normalizedOptions, correctAnswer: correct, orderIndex };

  const question =
    id && (await prisma.question.findFirst({ where: { id, packId } }))
      ? await prisma.question.update({ where: { id }, data })
      : await prisma.question.create({ data: { ...data, packId } });

  await prisma.questionPack.update({ where: { id: packId }, data: { updatedAt: new Date() } });
  return NextResponse.json({ question: serializeQuestion(question) });
}
