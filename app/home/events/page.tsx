import { EventsScreen } from '@/components/shared/EventsScreen';
import { getAllEvents } from '@/lib/screen-data';

export const dynamic = 'force-dynamic';

export default async function MemberEventsPage() {
  const events = await getAllEvents();
  return <EventsScreen canManage={false} initialEvents={events} />;
}
