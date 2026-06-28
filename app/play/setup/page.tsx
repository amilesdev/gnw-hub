import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/play/queries';
import { GameSetup, type SetupPack } from '@/components/play/GameSetup';

export const dynamic = 'force-dynamic';

export default async function GameSetupPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/play');

  // One game at a time — if one's live, send the host back to manage it.
  const current = await getCurrentSession();
  if (current && current.hostId === user.id) {
    redirect(current.status === 'lobby'
      ? `/play/session/${current.id}/lobby`
      : `/play/session/${current.id}/play`);
  }
  if (current) redirect('/play');

  const packs = await prisma.questionPack.findMany({
    where: { createdById: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { questions: true } } },
  });

  const setupPacks: SetupPack[] = packs.map((p) => ({
    id: p.id,
    name: p.name,
    questionCount: p._count.questions,
  }));

  return <GameSetup packs={setupPacks} />;
}
