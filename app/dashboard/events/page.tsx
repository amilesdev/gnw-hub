import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { EventsScreen } from '@/components/shared/EventsScreen';
import { getAllEvents } from '@/lib/screen-data';

export const dynamic = 'force-dynamic';

export default async function LeaderEventsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home');
  const events = await getAllEvents();
  return <EventsScreen canManage initialEvents={events} />;
}
