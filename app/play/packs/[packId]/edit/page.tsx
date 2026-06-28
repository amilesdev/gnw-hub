import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { isPackLocked, serializeQuestion, type SerializedPack } from '@/lib/play/packs';
import { PackBuilder } from '@/components/play/PackBuilder';

export const dynamic = 'force-dynamic';

export default async function PackBuilderPage({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  const { packId } = await params;
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/play');

  const pack = await prisma.questionPack.findUnique({
    where: { id: packId },
    include: { questions: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!pack) notFound();
  if (pack.createdById !== user.id && !user.isSuperAdmin) redirect('/play');

  const serialized: SerializedPack = {
    id: pack.id,
    name: pack.name,
    locked: await isPackLocked(pack.id),
    questions: pack.questions.map(serializeQuestion),
  };

  return <PackBuilder initialPack={serialized} />;
}
