import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getCurrentSession, getPlayPointsLeaderboard } from '@/lib/play/queries';
import { countIncomplete, QUESTION_READINESS_SELECT } from '@/lib/play/packs';
import { PlayHome, type PackSummary, type ActiveGame } from '@/components/play/PlayHome';

export const dynamic = 'force-dynamic';

export default async function PlayHomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const isLeader = user.role === 'leader';

  const [me, current, packs, leaderboard] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { playPoints: true } }),
    getCurrentSession(),
    isLeader
      ? prisma.questionPack.findMany({
          where: { createdById: user.id },
          orderBy: { updatedAt: 'desc' },
          include: { questions: { select: QUESTION_READINESS_SELECT } },
        })
      : Promise.resolve([]),
    getPlayPointsLeaderboard(),
  ]);

  let activeGame: ActiveGame | null = null;
  if (current) {
    const pack = await prisma.questionPack.findUnique({
      where: { id: current.packId },
      select: { name: true },
    });
    const playerCount = await prisma.gamePlayer.count({ where: { sessionId: current.id } });
    activeGame = {
      sessionId: current.id,
      mode: current.mode,
      status: current.status as 'lobby' | 'active',
      packName: pack?.name ?? 'Game',
      playerCount,
      isHost: current.hostId === user.id,
    };
  }

  const packSummaries: PackSummary[] = packs.map((p) => ({
    id: p.id,
    name: p.name,
    questionCount: p.questions.length,
    incompleteCount: countIncomplete(p.questions),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <PlayHome
      role={isLeader ? 'leader' : 'member'}
      firstName={(user.name ?? '').split(' ')[0] || 'friend'}
      playPoints={me?.playPoints ?? 0}
      packs={packSummaries}
      activeGame={activeGame}
      leaderboard={leaderboard}
      currentUserId={user.id}
    />
  );
}
