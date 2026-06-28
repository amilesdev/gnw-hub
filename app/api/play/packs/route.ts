import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { packCreateSchema } from '@/lib/play/validation';

// GET /api/play/packs — packs owned by the caller, with question counts, for
// Play Home + the game-setup pack picker. Leader only.
export async function GET() {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const packs = await prisma.questionPack.findMany({
    where: { createdById: guard.user.id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { questions: true } } },
  });

  return NextResponse.json({
    packs: packs.map((p) => ({
      id: p.id,
      name: p.name,
      questionCount: p._count.questions,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

// POST /api/play/packs — create an empty pack and return its id so the client
// can navigate straight into the builder.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = packCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const pack = await prisma.questionPack.create({
    data: { name: parsed.data.name, createdById: guard.user.id },
  });
  return NextResponse.json({ id: pack.id }, { status: 201 });
}
