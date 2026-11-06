import { SongsTab } from '@/components/shared/SongsTab';
import { getAllSetlists } from '@/lib/screen-data';

export const dynamic = 'force-dynamic';

export default async function MemberSetlistPage() {
  const setlists = await getAllSetlists();
  return <SongsTab role="member" initialSetlists={setlists} />;
}
