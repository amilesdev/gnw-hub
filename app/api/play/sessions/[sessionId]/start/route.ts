import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireHost } from '@/lib/play/auth';
import { broadcast } from '@/lib/play/realtime-server';

type Ctx = { params: Promise<{ sessionId: string }> };

// POST /api/play/sessions/[sessionId]/start — host starts the game. Locks the
// lobby (status → active) and broadcasts the 3-2-1 countdown. The host client
// then calls start-question once the countdown finishes (spec §5.2).
export async function POST(_req: Request, { params }: Ctx) {
  const { sessionId } = await params;
  const guard = await requireHost(sessionId);
  if ('error' in guard) return guard.error;

  const playerCount = await prisma.gamePlayer.count({ where: { sessionId } });
  if (playerCount < 2) {
    return NextResponse.json({ error: 'Need at least 2 players' }, { status: 400 });
  }

  if (guard.session.status === 'lobby') {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'active', startedAt: new Date() },
    });
  }

  await broadcast(sessionId, { type: 'GAME_STARTING', countdown: 3 });
  return NextResponse.json({ ok: true });
}
