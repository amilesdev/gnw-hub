import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getSuggestions } from '@/lib/suggestions';
import { SuggestionsScreen } from '@/components/shared/SuggestionsScreen';

export const dynamic = 'force-dynamic';

export default async function LeaderSuggestionsPage() {
  const session = await getSessionUser();
  if (!session?.id) redirect('/login');
  if (session.role !== 'leader') redirect('/home/library/suggestions');
  const suggestions = await getSuggestions(session);
  return <SuggestionsScreen canManage meId={session.id} initialSuggestions={suggestions} backHref="/dashboard/library" />;
}
