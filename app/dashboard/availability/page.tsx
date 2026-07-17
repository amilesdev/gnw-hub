import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { AvailabilityManager } from '@/components/shared/AvailabilityManager';

export const dynamic = 'force-dynamic';

// A leader is on the team too — this is their own blackout dates (the same
// self-serve screen members get). The team-wide overview lives separately at
// /dashboard/availability/team.
export default async function LeaderAvailabilityPage() {
  const session = await getSessionUser();
  if (!session?.id) redirect('/login');
  if (session.role !== 'leader') redirect('/home');
  return <AvailabilityManager />;
}
