import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getUpcomingEvents, getActiveAnnouncements, getThisWeekSetlist } from '@/lib/home-data';
import { getVerseOfDay } from '@/lib/bible';
import { MemberHome } from '@/components/member/MemberHome';
import { getMyProductionTasks } from '@/lib/production/server';

export const dynamic = 'force-dynamic';

export default async function MemberHomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const [events, announcements, thisWeek, production] = await Promise.all([
    getUpcomingEvents(),
    getActiveAnnouncements(),
    getThisWeekSetlist(),
    getMyProductionTasks(user.id),
  ]);
  const verse = getVerseOfDay(); // local, instant — verse-of-the-day ribbon + empty states

  return (
    <MemberHome
      name={user.name ?? ''}
      events={events}
      announcements={announcements}
      thisWeek={thisWeek}
      verse={verse}
      production={production}
    />
  );
}
