import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { ProfileView } from '@/components/shared/ProfileView';
import { MembersManager, type MemberRow } from '@/components/leader/MembersManager';
import { inviteUrl } from '@/lib/invites';

export const dynamic = 'force-dynamic';

export default async function LeaderSettingsPage() {
  const session = await getSessionUser();
  if (!session?.id) redirect('/login');
  if (session.role !== 'leader') redirect('/home');

  // Read fresh from the DB so leader edits (name, part, role) show immediately,
  // rather than the stale values frozen into the JWT at login.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, role: true, section: true, part: true, image: true, isSuperAdmin: true },
  });
  if (!user) redirect('/login');

  const rows = await prisma.user.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      section: true,
      part: true,
      status: true,
      isSuperAdmin: true,
      inviteExpiry: true,
      inviteToken: true,
    },
  });

  const initialMembers: MemberRow[] = rows.map(({ inviteToken, ...r }) => ({
    ...r,
    inviteExpiry: r.inviteExpiry ? r.inviteExpiry.toISOString() : null,
    inviteUrl: r.status === 'pending' && inviteToken ? inviteUrl(inviteToken) : null,
  }));

  return (
    <div className="space-y-10">
      <ProfileView
        userId={session.id}
        name={user.name ?? ''}
        email={user.email ?? ''}
        role={user.role}
        section={user.section ?? null}
        part={user.part ?? null}
        image={user.image ?? null}
        isSuperAdmin={user.isSuperAdmin}
      />
      <MembersManager initialMembers={initialMembers} />
    </div>
  );
}
