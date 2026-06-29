import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { getPollResults } from '@/lib/polls';

// GET /api/polls/mine — member-facing list of polls the current user can see
// results for: ones they've voted on (still open → editable) plus any that have
// ended. Open polls they haven't answered yet are handled by the blocking gate,
// so they're left out here. Member-safe — no per-voter breakdown, matching the
// rule that results stay anonymous to non-leaders.
export async function GET() {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const userId = guard.user.id;

  const polls = await prisma.poll.findMany({
    where: {
      OR: [{ endsAt: { lte: new Date() } }, { votes: { some: { userId } } }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const results = await Promise.all(polls.map((p) => getPollResults(p.id, userId)));
  return NextResponse.json({ polls: results.filter((r) => r !== null) });
}
