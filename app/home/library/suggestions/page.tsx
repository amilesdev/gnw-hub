import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getSuggestions } from '@/lib/suggestions';
import { SuggestionsScreen } from '@/components/shared/SuggestionsScreen';

export const dynamic = 'force-dynamic';

export default async function MemberSuggestionsPage() {
  const session = await getSessionUser();
  if (!session?.id) redirect('/login');
  const suggestions = await getSuggestions(session);
  return <SuggestionsScreen canManage={false} meId={session.id} initialSuggestions={suggestions} backHref="/home/setlist?view=library" />;
}
