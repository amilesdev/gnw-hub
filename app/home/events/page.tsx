import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { EventsScreen } from '@/components/shared/EventsScreen';
import { getAllEvents } from '@/lib/screen-data';

export const dynamic = 'force-dynamic';

export default async function MemberEventsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const events = await getAllEvents(user.role);
  return <EventsScreen canManage={false} initialEvents={events} />;
}
