import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guestCookieFor } from '@/lib/play/auth';
import { broadcast } from '@/lib/play/realtime-server';
import { guestJoinSchema } from '@/lib/play/validation';

// POST /api/play/guest-join — public. A guest joins via a session's link token,
// no Hub auth. Creates a guest GamePlayer and sets a signed, session-scoped
// cookie identifying them. Only valid while the session is in 'lobby'.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = guestJoinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const session = await prisma.gameSession.findFirst({
    where: { guestLinkToken: parsed.data.token, guestAccessEnabled: true },
  });
  if (!session) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
  if (session.status !== 'lobby') {
    return NextResponse.json({ error: 'This game has already started' }, { status: 409 });
  }

  const player = await prisma.gamePlayer.create({
    data: { sessionId: session.id, guestName: parsed.data.name },
  });

  await broadcast(session.id, { type: 'LOBBY_UPDATE' });

  const res = NextResponse.json({ sessionId: session.id, playerId: player.id });
  const cookie = guestCookieFor(session.id, player.id);
  res.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 6, // 6h — long enough for a game session
  });
  return res;
}
