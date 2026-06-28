import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireHost } from '@/lib/play/auth';
import { broadcast } from '@/lib/play/realtime-server';
import { removePlayerSchema } from '@/lib/play/validation';

// POST /api/play/remove-player — host removes a player. In the lobby they're
// deleted; mid-game they become a spectator so their answers/score stay intact.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = removePlayerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const { sessionId, playerId } = parsed.data;

  const guard = await requireHost(sessionId);
  if ('error' in guard) return guard.error;

  if (guard.session.status === 'lobby') {
    await prisma.gamePlayer.deleteMany({ where: { id: playerId, sessionId } });
    await broadcast(sessionId, { type: 'LOBBY_UPDATE' });
  } else {
    await prisma.gamePlayer.updateMany({
      where: { id: playerId, sessionId },
      data: { isSpectator: true, isEliminated: true },
    });
  }

  await broadcast(sessionId, { type: 'PLAYER_REMOVED', playerId });
  return NextResponse.json({ ok: true });
}
