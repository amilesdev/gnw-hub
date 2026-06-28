import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { getCurrentSession } from '@/lib/play/queries';
import { createSessionSchema, MIN_QUESTIONS_TO_PLAY } from '@/lib/play/validation';
import { randomToken } from '@/lib/utils';
import type { GameSettings } from '@/lib/play/types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// POST /api/play/sessions — create a lobby (Launch Game / Quick Start). Enforces
// the one-active-session-at-a-time and 5+ question constraints, builds the play
// order, and seeds round_state (+ teams for team_battle). The host is the game
// master, not a player. Returns the session id for navigation to the lobby.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const existing = await getCurrentSession();
  if (existing) {
    return NextResponse.json({ error: 'A game is already running. End it first.' }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { packId, mode, settings, guestAccess } = parsed.data;

  if (mode === 'team_battle' && !settings.team_names) {
    return NextResponse.json({ error: 'Team Battle needs two team names' }, { status: 400 });
  }

  const pack = await prisma.questionPack.findUnique({
    where: { id: packId },
    include: { questions: { orderBy: { orderIndex: 'asc' }, select: { id: true } } },
  });
  if (!pack) return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
  if (pack.createdById !== guard.user.id && !guard.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Not your pack' }, { status: 403 });
  }
  if (pack.questions.length < MIN_QUESTIONS_TO_PLAY) {
    return NextResponse.json({ error: `Pack needs ${MIN_QUESTIONS_TO_PLAY}+ questions` }, { status: 400 });
  }

  const ids = pack.questions.map((q) => q.id);
  const questionOrder = settings.shuffle ? shuffle(ids) : ids;
  const cleanSettings: GameSettings = {
    time_per_question: settings.time_per_question,
    shuffle: settings.shuffle,
    ...(mode === 'team_battle' && settings.team_names ? { team_names: settings.team_names } : {}),
  };

  const session = await prisma.gameSession.create({
    data: {
      packId,
      hostId: guard.user.id,
      mode,
      status: 'lobby',
      settings: cleanSettings as object,
      questionOrder,
      guestAccessEnabled: guestAccess,
      guestLinkToken: guestAccess ? randomToken(12) : null,
      roundState: { create: {} },
      ...(mode === 'team_battle' && settings.team_names
        ? { teams: { create: settings.team_names.map((name) => ({ name })) } }
        : {}),
    },
  });

  return NextResponse.json({ id: session.id, guestToken: session.guestLinkToken }, { status: 201 });
}
