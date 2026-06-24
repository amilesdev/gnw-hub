import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { SetlistManager } from '@/components/leader/SetlistManager';

export default async function LeaderSetlistPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home');
  return <SetlistManager />;
}
