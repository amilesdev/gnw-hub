import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { TeamAvailability } from '@/components/leader/TeamAvailability';

export const dynamic = 'force-dynamic';

export default async function TeamAvailabilityPage() {
  const session = await getSessionUser();
  if (!session?.id) redirect('/login');
  if (session.role !== 'leader') redirect('/home');
  return <TeamAvailability />;
}
