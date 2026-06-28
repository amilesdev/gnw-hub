import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePackOwner, isPackLocked } from '@/lib/play/packs';
import { reorderSchema } from '@/lib/play/validation';

type Ctx = { params: Promise<{ packId: string }> };

// POST /api/play/packs/[packId]/reorder — persist a new question order in one
// batch after a drag-drop. order is the full list of this pack's question ids.
export async function POST(req: Request, { params }: Ctx) {
  const { packId } = await params;
  const guard = await requirePackOwner(packId);
  if ('error' in guard) return guard.error;
  if (await isPackLocked(packId)) {
    return NextResponse.json({ error: 'Pack is locked during a live game' }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.order.map((id, index) =>
      prisma.question.updateMany({ where: { id, packId }, data: { orderIndex: index } }),
    ),
  );
  return NextResponse.json({ ok: true });
}
