import { redirect } from 'next/navigation';
import { SongsTab } from '@/components/shared/SongsTab';
import { getAllSetlists } from '@/lib/screen-data';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function MemberSetlistPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const setlists = await getAllSetlists(user.role);
  return <SongsTab role="member" initialSetlists={setlists} />;
}
