import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { getActor } from '@/lib/play/auth';
import { buildLobbySnapshot } from '@/lib/play/queries';
import { broadcast } from '@/lib/play/realtime-server';
import { Lobby } from '@/components/play/Lobby';

export const dynamic = 'force-dynamic';

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session) notFound();
  if (session.status === 'ended') redirect(`/play/session/${sessionId}/results`);

  const user = await getSessionUser();

  // Auto-join: a Hub member/leader (not the host) who lands on a live lobby and
  // isn't seated yet gets a seat — "Join Game" requires no code (spec §3.2).
  if (user && user.id !== session.hostId && session.status === 'lobby') {
    const seated = await prisma.gamePlayer.findFirst({ where: { sessionId, userId: user.id } });
    if (!seated) {
      await prisma.gamePlayer.create({ data: { sessionId, userId: user.id } });
      await broadcast(sessionId, { type: 'LOBBY_UPDATE' });
    }
  }

  const actor = await getActor(sessionId);
  // A non-host with no seat (e.g. guest without a cookie) can't be in this lobby.
  if (!actor) redirect('/play');

  const snapshot = await buildLobbySnapshot(sessionId, actor);
  if (!snapshot) notFound();
  if (!snapshot.isHost && snapshot.mePlayerId === null) redirect('/play');

  // If the game already kicked off, jump straight into it.
  if (session.status === 'active') redirect(`/play/session/${sessionId}/play`);

  return <Lobby initial={snapshot} />;
}
