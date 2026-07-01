import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getUpcomingEvents, getActiveAnnouncements, getThisWeekSetlist } from '@/lib/home-data';
import { getVerseOfDay } from '@/lib/bible';
import { MemberHome } from '@/components/member/MemberHome';

export const dynamic = 'force-dynamic';

export default async function MemberHomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const [events, announcements, thisWeek] = await Promise.all([
    getUpcomingEvents(),
    getActiveAnnouncements(),
    getThisWeekSetlist(),
  ]);
  const verse = getVerseOfDay(); // local, instant — verse-of-the-day ribbon + empty states

  return (
    <MemberHome
      name={user.name ?? ''}
      events={events}
      announcements={announcements}
      thisWeek={thisWeek}
      verse={verse}
    />
  );
}
