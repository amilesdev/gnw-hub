import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { SongsTab } from '@/components/shared/SongsTab';

export default async function LeaderSetlistPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home');
  return <SongsTab role="leader" />;
}
