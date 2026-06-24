import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getUpcomingEvents, getActiveAnnouncements, getThisWeekSetlist, getLeaderAlerts } from '@/lib/home-data';
import { LeaderHome } from '@/components/leader/LeaderHome';

export const dynamic = 'force-dynamic';

export default async function LeaderHomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home');

  const [events, announcements, thisWeek] = await Promise.all([
    getUpcomingEvents(),
    getActiveAnnouncements(),
    getThisWeekSetlist(),
  ]);
  const alerts = await getLeaderAlerts(thisWeek);

  return (
    <LeaderHome
      name={user.name ?? ''}
      events={events}
      announcements={announcements}
      thisWeek={thisWeek}
      alerts={alerts}
    />
  );
}
