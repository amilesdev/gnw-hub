import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { AvailabilityManager } from '@/components/shared/AvailabilityManager';

export const dynamic = 'force-dynamic';

export default async function MemberAvailabilityPage() {
  const session = await getSessionUser();
  if (!session?.id) redirect('/login');
  return <AvailabilityManager />;
}
