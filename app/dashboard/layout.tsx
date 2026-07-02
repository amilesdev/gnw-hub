import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { AppShell } from '@/components/shared/AppShell';

// Authoritative gate for every /dashboard/* screen: signed-in AND still a
// leader, re-checked live each request (middleware can't see a revocation or a
// role change baked into an older token).
export default async function LeaderLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home');
  return <AppShell variant="leader">{children}</AppShell>;
}
