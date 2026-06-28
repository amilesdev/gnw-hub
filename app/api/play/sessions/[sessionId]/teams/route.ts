import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireHost } from '@/lib/play/auth';
import { broadcast } from '@/lib/play/realtime-server';
import { assignTeamsSchema } from '@/lib/play/validation';
import type { GameSettings } from '@/lib/play/types';

type Ctx = { params: Promise<{ sessionId: string }> };

// POST /api/play/sessions/[sessionId]/teams — host sets team assignments for
// team_battle (drag or Randomize). Assignments map playerId → team name; only
// the two configured team names are accepted.
export async function POST(req: Request, { params }: Ctx) {
  const { sessionId } = await params;
  const guard = await requireHost(sessionId);
  if ('error' in guard) return guard.error;
  if (guard.session.mode !== 'team_battle') {
    return NextResponse.json({ error: 'Not a team game' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = assignTeamsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid assignments' }, { status: 400 });

  const settings = guard.session.settings as unknown as GameSettings;
  const valid = new Set(settings.team_names ?? []);

  await prisma.$transaction(
    Object.entries(parsed.data.assignments)
      .filter(([, team]) => valid.has(team))
      .map(([playerId, team]) =>
        prisma.gamePlayer.updateMany({ where: { id: playerId, sessionId }, data: { team } }),
      ),
  );

  await broadcast(sessionId, { type: 'LOBBY_UPDATE' });
  return NextResponse.json({ ok: true });
}
