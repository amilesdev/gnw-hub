import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/availability/[id] — remove a blackout date. You can remove your
// own; a leader can remove anyone's.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const me = guard.user;
  const { id } = await params;

  const row = await prisma.unavailability.findUnique({ where: { id }, select: { userId: true } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.userId !== me.id && me.role !== 'leader') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.unavailability.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
