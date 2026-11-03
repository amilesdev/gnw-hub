import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getUpcomingEvents, getActiveAnnouncements, getThisWeekSetlist, getLeaderAlerts } from '@/lib/home-data';
import { getVerseOfDay } from '@/lib/bible';
import { LeaderHome } from '@/components/leader/LeaderHome';
import { getMyProductionTasks } from '@/lib/production/server';

export const dynamic = 'force-dynamic';

export default async function LeaderHomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home');

  const [events, announcements, thisWeek, alerts, production] = await Promise.all([
    getUpcomingEvents(),
    getActiveAnnouncements(),
    getThisWeekSetlist(),
    getLeaderAlerts(),
    getMyProductionTasks(user.id),
  ]);

  return (
    <LeaderHome
      name={user.name ?? ''}
      events={events}
      announcements={announcements}
      thisWeek={thisWeek}
      alerts={alerts}
      verse={getVerseOfDay()}
      production={production}
    />
  );
}
