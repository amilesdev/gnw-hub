import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { serializePoll } from '@/lib/serialize';

// GET /api/polls/active — open polls (not yet ended) the current user hasn't
// voted on yet. Drives the blocking poll gate. Oldest first so a backlog is
// cleared in the order it was posted. No tallies are sent (results stay hidden
// until you vote).
export async function GET() {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const polls = await prisma.poll.findMany({
    where: {
      endsAt: { gt: new Date() },
      votes: { none: { userId: guard.user.id } },
    },
    orderBy: { createdAt: 'asc' },
    include: { choices: { orderBy: { position: 'asc' } } },
  });

  return NextResponse.json({ polls: polls.map(serializePoll) });
}
