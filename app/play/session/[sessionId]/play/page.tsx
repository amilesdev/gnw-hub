import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getActor } from '@/lib/play/auth';
import { buildGameSnapshot } from '@/lib/play/engine';
import { LiveGame } from '@/components/play/LiveGame';

export const dynamic = 'force-dynamic';

export default async function LiveGamePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session) notFound();
  if (session.status === 'ended') redirect(`/play/session/${sessionId}/results`);
  if (session.status === 'lobby') redirect(`/play/session/${sessionId}/lobby`);

  const actor = await getActor(sessionId);
  if (!actor) redirect('/play');

  const snapshot = await buildGameSnapshot(sessionId, actor);
  if (!snapshot) notFound();
  if (!snapshot.me.isHost && !snapshot.me.player) redirect('/play');

  return <LiveGame initial={snapshot} />;
}
