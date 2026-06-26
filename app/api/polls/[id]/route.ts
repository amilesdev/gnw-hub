import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/polls/[id] — leader only. Removes the poll, its choices and votes
// (cascade), so it stops blocking anyone immediately.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.poll.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Poll not found' }, { status: 404 });

  await prisma.poll.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
