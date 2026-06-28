import { NextResponse } from 'next/server';
import { requireHost } from '@/lib/play/auth';
import { broadcast } from '@/lib/play/realtime-server';
import { sessionIdSchema } from '@/lib/play/validation';

// POST /api/play/pause — host pauses; clients freeze their display timer (the
// server clock is wall-time, so pause is best used between rounds).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const guard = await requireHost(parsed.data.sessionId);
  if ('error' in guard) return guard.error;

  await broadcast(parsed.data.sessionId, { type: 'GAME_PAUSED' });
  return NextResponse.json({ ok: true });
}
