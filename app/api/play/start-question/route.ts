import { NextResponse } from 'next/server';
import { requireHost } from '@/lib/play/auth';
import { startQuestion } from '@/lib/play/engine';
import { sessionIdSchema } from '@/lib/play/validation';

// POST /api/play/start-question — host begins (or advances to) a question. The
// server stamps question_start_at and broadcasts QUESTION_START (spec §5.3, §5.6).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const guard = await requireHost(parsed.data.sessionId);
  if ('error' in guard) return guard.error;

  const result = await startQuestion(parsed.data.sessionId);
  return NextResponse.json(result);
}
