import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getProductionScreenData } from '@/lib/production/server';
import { ProductionScreen, type ProductionTab } from '@/components/production/ProductionScreen';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ event?: string; tab?: string }> };

export default async function LeaderProductionPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home/production');
  const { event, tab } = await searchParams;
  const data = await getProductionScreenData(event ?? null, true);
  return (
    <ProductionScreen
      key={data.event?.id ?? 'none'}
      initial={data}
      base="/dashboard"
      meId={user.id}
      canManage
      initialTab={(['map', 'checklist', 'trace'].includes(tab ?? '') ? tab : 'map') as ProductionTab}
    />
  );
}
