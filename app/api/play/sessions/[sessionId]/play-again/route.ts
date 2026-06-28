import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireHost } from '@/lib/play/auth';
import { broadcast } from '@/lib/play/realtime-server';
import { randomToken } from '@/lib/utils';
import type { GameSettings } from '@/lib/play/types';

type Ctx = { params: Promise<{ sessionId: string }> };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// POST /api/play/sessions/[sessionId]/play-again — host rematch. Creates a fresh
// lobby with the same pack + settings, re-seats the registered players with reset
// state, and broadcasts PLAY_AGAIN on the old channel so result-screen clients
// follow to the new lobby (guests rejoin via a fresh link). Spec §7.5.
export async function POST(_req: Request, { params }: Ctx) {
  const { sessionId } = await params;
  const guard = await requireHost(sessionId);
  if ('error' in guard) return guard.error;
  const old = guard.session;

  const settings = old.settings as unknown as GameSettings;
  const pack = await prisma.question.findMany({
    where: { packId: old.packId },
    orderBy: { orderIndex: 'asc' },
    select: { id: true },
  });
  const ids = pack.map((q) => q.id);
  const questionOrder = settings.shuffle ? shuffle(ids) : ids;

  const players = await prisma.gamePlayer.findMany({
    where: { sessionId, userId: { not: null } },
    select: { userId: true, team: true },
  });

  const created = await prisma.gameSession.create({
    data: {
      packId: old.packId,
      hostId: old.hostId,
      mode: old.mode,
      status: 'lobby',
      settings: settings as object,
      questionOrder,
      guestAccessEnabled: old.guestAccessEnabled,
      guestLinkToken: old.guestAccessEnabled ? randomToken(12) : null,
      roundState: { create: {} },
      ...(old.mode === 'team_battle' && settings.team_names
        ? { teams: { create: settings.team_names.map((name) => ({ name })) } }
        : {}),
      ...(players.length
        ? { players: { create: players.map((p) => ({ userId: p.userId, team: p.team })) } }
        : {}),
    },
  });

  await broadcast(sessionId, { type: 'PLAY_AGAIN', sessionId: created.id });
  return NextResponse.json({ id: created.id });
}
