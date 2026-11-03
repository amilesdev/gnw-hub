import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';

// Role-neutral link target (reminder pushes, shared links): sends leaders to the
// dashboard copy of Production and members to theirs, keeping the query.
type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ProductionRedirect({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const params = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => !!e[1]));
  const qs = params.toString();
  redirect(`${user.role === 'leader' ? '/dashboard' : '/home'}/production${qs ? `?${qs}` : ''}`);
}
