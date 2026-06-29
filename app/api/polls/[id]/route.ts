import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader, requireUser } from '@/lib/session';
import { getPollResults } from '@/lib/polls';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/polls/[id] — results for a single poll from the current user's
// perspective. Results stay hidden until you've voted (or the poll has ended),
// matching the gate's rules. Member-safe: no per-voter breakdown. The poll gate
// re-polls this so a voter's results panel updates live as more answers land.
export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const { id } = await params;
  const userId = guard.user.id;

  const poll = await prisma.poll.findUnique({ where: { id }, select: { endsAt: true } });
  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 });

  const ended = poll.endsAt.getTime() <= Date.now();
  const voted = !!(await prisma.pollVote.findFirst({
    where: { pollId: id, userId },
    select: { id: true },
  }));
  if (!voted && !ended) {
    return NextResponse.json({ error: 'Vote to see results.' }, { status: 403 });
  }

  const results = await getPollResults(id, userId);
  if (!results) return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
  return NextResponse.json({ results });
}

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
