import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { broadcast } from '@/lib/play/realtime-server';

type Ctx = { params: Promise<{ sessionId: string }> };

// POST /api/play/sessions/[sessionId]/join — a Hub member/leader self-joins the
// lobby (no code needed). Idempotent: re-joining returns the existing seat. No
// mid-game joins — only while status is 'lobby'.
export async function POST(_req: Request, { params }: Ctx) {
  const { sessionId } = await params;
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.status !== 'lobby') {
    return NextResponse.json({ error: 'This game has already started' }, { status: 409 });
  }

  const existing = await prisma.gamePlayer.findFirst({
    where: { sessionId, userId: guard.user.id },
  });
  const player =
    existing ??
    (await prisma.gamePlayer.create({ data: { sessionId, userId: guard.user.id } }));

  if (!existing) await broadcast(sessionId, { type: 'LOBBY_UPDATE' });
  return NextResponse.json({ playerId: player.id });
}
