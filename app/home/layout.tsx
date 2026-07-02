import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { AppShell } from '@/components/shared/AppShell';

// Authoritative gate for every /home/* screen. Middleware only checks that a
// (validly signed) token exists; this re-validates the account each request, so
// a removed/deactivated member is bounced even on sub-pages that don't fetch
// user data themselves.
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <AppShell variant="member">{children}</AppShell>;
}
