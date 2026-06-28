import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePackOwner, isPackLocked, serializeQuestion } from '@/lib/play/packs';
import { packRenameSchema } from '@/lib/play/validation';

type Ctx = { params: Promise<{ packId: string }> };

// GET /api/play/packs/[packId] — full pack with ordered questions + lock state.
export async function GET(_req: Request, { params }: Ctx) {
  const { packId } = await params;
  const guard = await requirePackOwner(packId);
  if ('error' in guard) return guard.error;

  const [questions, locked] = await Promise.all([
    prisma.question.findMany({ where: { packId }, orderBy: { orderIndex: 'asc' } }),
    isPackLocked(packId),
  ]);

  return NextResponse.json({
    pack: {
      id: guard.pack.id,
      name: guard.pack.name,
      locked,
      questions: questions.map(serializeQuestion),
    },
  });
}

// PATCH /api/play/packs/[packId] — rename. Blocked while the pack is in a live game.
export async function PATCH(req: Request, { params }: Ctx) {
  const { packId } = await params;
  const guard = await requirePackOwner(packId);
  if ('error' in guard) return guard.error;
  if (await isPackLocked(packId)) {
    return NextResponse.json({ error: 'Pack is locked during a live game' }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = packRenameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await prisma.questionPack.update({ where: { id: packId }, data: { name: parsed.data.name } });
  return NextResponse.json({ ok: true });
}

// DELETE /api/play/packs/[packId] — removes the pack and its questions (cascade).
export async function DELETE(_req: Request, { params }: Ctx) {
  const { packId } = await params;
  const guard = await requirePackOwner(packId);
  if ('error' in guard) return guard.error;
  if (await isPackLocked(packId)) {
    return NextResponse.json({ error: 'Pack is locked during a live game' }, { status: 409 });
  }

  // GameSession.pack has no cascade (history is kept by default), so a pack that
  // was ever used in a finished game can't be deleted directly. The lock check
  // above already rules out live games, so any remaining sessions are over —
  // clear them (and their cascading children) first, then drop the pack.
  await prisma.$transaction([
    prisma.gameSession.deleteMany({ where: { packId } }),
    prisma.questionPack.delete({ where: { id: packId } }),
  ]);
  return NextResponse.json({ ok: true });
}
