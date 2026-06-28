import { NextResponse } from 'next/server';
import { getActor, getActorPlayer } from '@/lib/play/auth';
import { recordAnswer } from '@/lib/play/engine';
import { submitAnswerSchema } from '@/lib/play/validation';

// POST /api/play/submit-answer — a player locks in an answer. The server records
// the timestamp (never the client's), validates the round is still accepting,
// and returns only { accepted } — correctness is withheld until reveal (§5.4).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = submitAnswerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const { sessionId, questionId, answer } = parsed.data;

  const actor = await getActor(sessionId);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const player = await getActorPlayer(sessionId, actor);
  if (!player) return NextResponse.json({ error: 'Not in this game' }, { status: 403 });

  const result = await recordAnswer(sessionId, player.id, questionId, answer);
  if (!result.accepted) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json({ accepted: true });
}
