import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { ProfileView } from '@/components/shared/ProfileView';

export const dynamic = 'force-dynamic';

export default async function MemberProfilePage() {
  const session = await getSessionUser();
  if (!session?.id) redirect('/login');

  // Read fresh from the DB so leader edits (name, part, role) show immediately,
  // rather than the stale values frozen into the JWT at login.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, role: true, section: true, part: true, isSuperAdmin: true },
  });
  if (!user) redirect('/login');

  return (
    <ProfileView
      name={user.name ?? ''}
      email={user.email ?? ''}
      role={user.role}
      section={user.section ?? null}
      part={user.part ?? null}
      isSuperAdmin={user.isSuperAdmin}
    />
  );
}
