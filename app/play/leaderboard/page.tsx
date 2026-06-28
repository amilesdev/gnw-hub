import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getPlayPointsLeaderboard } from '@/lib/play/queries';
import { PlayLeaderboard } from '@/components/play/PlayLeaderboard';

export const dynamic = 'force-dynamic';

export default async function PlayLeaderboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const rows = await getPlayPointsLeaderboard();
  return <PlayLeaderboard rows={rows} currentUserId={user.id} />;
}
