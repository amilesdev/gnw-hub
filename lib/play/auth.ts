import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import type { GameSession, GamePlayer } from '@prisma/client';

// A guest is identified by a signed cookie holding their game_players row id.
// Signed with NEXTAUTH_SECRET so a guest can't impersonate another player by
// editing the cookie. Scoped per session via the cookie name.
const SECRET = process.env.NEXTAUTH_SECRET ?? 'dev-secret';

function guestCookieName(sessionId: string): string {
  return `gnw_play_guest_${sessionId}`;
}

function sign(value: string): string {
  return createHmac('sha256', SECRET).update(value).digest('hex');
}

export function makeGuestCookieValue(playerId: string): string {
  return `${playerId}.${sign(playerId)}`;
}

function verifyGuestCookieValue(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot === -1) return null;
  const playerId = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  const expected = sign(playerId);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return playerId;
}

export interface SetGuestCookie {
  name: string;
  value: string;
}

/** Build the cookie a guest-join route should set on its response. */
export function guestCookieFor(sessionId: string, playerId: string): SetGuestCookie {
  return { name: guestCookieName(sessionId), value: makeGuestCookieValue(playerId) };
}

export type Actor =
  | { kind: 'user'; userId: string; name: string }
  | { kind: 'guest'; playerId: string };

/**
 * Resolve who is acting in a session: a logged-in Hub user (NextAuth) or a guest
 * (signed cookie). Returns null if neither is present.
 */
export async function getActor(sessionId: string): Promise<Actor | null> {
  const user = await getSessionUser();
  if (user) return { kind: 'user', userId: user.id, name: user.name ?? 'Player' };

  const jar = await cookies();
  const playerId = verifyGuestCookieValue(jar.get(guestCookieName(sessionId))?.value);
  if (playerId) return { kind: 'guest', playerId };
  return null;
}

/** Find the caller's GamePlayer row in a session (user or guest), or null. */
export async function getActorPlayer(
  sessionId: string,
  actor: Actor,
): Promise<GamePlayer | null> {
  if (actor.kind === 'user') {
    return prisma.gamePlayer.findFirst({ where: { sessionId, userId: actor.userId } });
  }
  return prisma.gamePlayer.findFirst({ where: { id: actor.playerId, sessionId } });
}

type Guard<T> = { error: NextResponse } | T;

/** API guard: caller must be the session's host. */
export async function requireHost(sessionId: string): Promise<Guard<{ session: GameSession; userId: string }>> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: NextResponse.json({ error: 'Session not found' }, { status: 404 }) };
  if (session.hostId !== user.id) {
    return { error: NextResponse.json({ error: 'Not the host' }, { status: 403 }) };
  }
  return { session, userId: user.id };
}
