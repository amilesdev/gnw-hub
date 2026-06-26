import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { getPollResults } from '@/lib/polls';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/polls/[id] — leader only. Ends an active poll early by moving its
// close time to now. After this it stops gating/accepting votes (the active
// query and `ended` flag both key off `endsAt`), so leaders can review and
// download immediately. Idempotent on an already-ended poll.
export async function PATCH(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.poll.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Poll not found' }, { status: 404 });

  if (existing.endsAt.getTime() > Date.now()) {
    await prisma.poll.update({ where: { id }, data: { endsAt: new Date() } });
  }

  const results = await getPollResults(id, guard.user.id, { includeVoters: true });
  return NextResponse.json({ poll: results });
}

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
