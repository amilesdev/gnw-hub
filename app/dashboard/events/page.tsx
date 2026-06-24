import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { EventsScreen } from '@/components/shared/EventsScreen';

export default async function LeaderEventsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home');
  return <EventsScreen canManage />;
}
