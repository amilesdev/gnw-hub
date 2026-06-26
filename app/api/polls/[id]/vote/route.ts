import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { pollVoteSchema } from '@/lib/validation';
import { getPollResults } from '@/lib/polls';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/polls/[id]/vote — record the current user's vote, then return the
// poll's results (votes make results public to the voter). Re-voting is a no-op
// that just returns current results, so the gate is safe to retry.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const { id } = await params;
  const userId = guard.user.id;

  const poll = await prisma.poll.findUnique({ where: { id }, include: { choices: true } });
  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
  if (poll.endsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This poll has ended.' }, { status: 409 });
  }

  // Already voted? Idempotent — hand back results without changing anything.
  const existing = await prisma.pollVote.findFirst({ where: { pollId: id, userId } });
  if (existing) {
    return NextResponse.json({ results: await getPollResults(id, userId) });
  }

  const parsed = pollVoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  // De-dupe and validate the selection against this poll's choices.
  const valid = new Set(poll.choices.map((c) => c.id));
  const choiceIds = [...new Set(parsed.data.choiceIds)].filter((cid) => valid.has(cid));
  if (choiceIds.length === 0) {
    return NextResponse.json({ error: 'Pick a valid option.' }, { status: 400 });
  }
  if (!poll.multiple && choiceIds.length > 1) {
    return NextResponse.json({ error: 'This poll allows only one answer.' }, { status: 400 });
  }

  await prisma.pollVote.createMany({
    data: choiceIds.map((choiceId) => ({ pollId: id, choiceId, userId })),
    skipDuplicates: true,
  });

  return NextResponse.json({ results: await getPollResults(id, userId) }, { status: 201 });
}
