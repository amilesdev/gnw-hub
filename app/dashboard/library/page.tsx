import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { SongLibrary } from '@/components/leader/SongLibrary';

export default async function LeaderLibraryPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home');
  return <SongLibrary />;
}
