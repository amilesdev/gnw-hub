import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { pollSchema } from '@/lib/validation';
import { getPollResults } from '@/lib/polls';
import { sendPush } from '@/lib/push';

// GET /api/polls — every poll (active + ended) with full results. Leader only;
// this is the leader's review/download surface, so tallies are always visible.
export async function GET() {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const polls = await prisma.poll.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true } });
  const results = await Promise.all(polls.map((p) => getPollResults(p.id, guard.user.id)));
  return NextResponse.json({ polls: results.filter((r) => r !== null) });
}

// POST /api/polls — create a poll. Leader only. Pushes to the whole team so it
// pops up promptly even for backgrounded devices.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = pollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const poll = await prisma.poll.create({
    data: {
      question: parsed.data.question,
      multiple: parsed.data.multiple,
      endsAt: new Date(parsed.data.endsAt),
      choices: {
        create: parsed.data.choices.map((text, position) => ({ text, position })),
      },
    },
    include: { choices: { orderBy: { position: 'asc' } } },
  });

  // Best-effort fan-out — a push failure shouldn't fail the create.
  await sendPush({ title: 'New poll', body: poll.question, url: '/', tag: `poll-${poll.id}` }).catch(() => {});

  return NextResponse.json({ poll: { id: poll.id } }, { status: 201 });
}
