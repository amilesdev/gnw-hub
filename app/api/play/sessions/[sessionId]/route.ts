import { NextResponse } from 'next/server';
import { getActor } from '@/lib/play/auth';
import { buildLobbySnapshot } from '@/lib/play/queries';

type Ctx = { params: Promise<{ sessionId: string }> };

// GET /api/play/sessions/[sessionId] — lobby/roster snapshot. Used for initial
// render and as the poll/reconnect fallback alongside Realtime. Open to any
// actor (Hub user or signed-in guest); the roster itself isn't sensitive.
export async function GET(_req: Request, { params }: Ctx) {
  const { sessionId } = await params;
  const actor = await getActor(sessionId);
  const snapshot = await buildLobbySnapshot(sessionId, actor);
  if (!snapshot) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json(snapshot);
}
