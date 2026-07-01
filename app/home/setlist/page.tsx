import { SetlistScreen } from '@/components/shared/SetlistScreen';
import { getAllSetlists } from '@/lib/screen-data';

export const dynamic = 'force-dynamic';

export default async function MemberSetlistPage() {
  const setlists = await getAllSetlists();
  return <SetlistScreen initialSetlists={setlists} />;
}
