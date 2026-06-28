import { NextResponse } from 'next/server';
import { requireHost } from '@/lib/play/auth';
import { endQuestion } from '@/lib/play/engine';
import { sessionIdSchema } from '@/lib/play/validation';

// POST /api/play/end-question — host (or the host's expired timer) closes the
// round. Scores all answers, applies mode effects, and broadcasts results +
// leaderboard (spec §5.5). Returns { gameOver } so the host UI shows Next vs
// Results. Idempotent: a second call after reveal is a no-op.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const guard = await requireHost(parsed.data.sessionId);
  if ('error' in guard) return guard.error;

  const result = await endQuestion(parsed.data.sessionId);
  return NextResponse.json(result);
}
