import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getActor } from '@/lib/play/auth';
import { buildFinalResults } from '@/lib/play/engine';
import { Results } from '@/components/play/Results';

export const dynamic = 'force-dynamic';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session) notFound();

  const actor = await getActor(sessionId);
  const isHost = actor?.kind === 'user' && actor.userId === session.hostId;
  const mePlayerId =
    actor?.kind === 'user'
      ? (await prisma.gamePlayer.findFirst({ where: { sessionId, userId: actor.userId } }))?.id ?? null
      : actor?.kind === 'guest'
        ? actor.playerId
        : null;

  const results = await buildFinalResults(sessionId);
  if (!results) notFound();
  // A live game that hasn't ended shouldn't show results.
  if (session.status !== 'ended') redirect(`/play/session/${sessionId}/play`);

  return <Results sessionId={sessionId} results={results} isHost={isHost} mePlayerId={mePlayerId} />;
}
