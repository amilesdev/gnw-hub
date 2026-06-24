import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { MembersManager, type MemberRow } from '@/components/leader/MembersManager';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'leader') redirect('/home');

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
    },
  });

  const initialMembers: MemberRow[] = rows.map((r) => ({
    ...r,
    inviteExpiry: r.inviteExpiry ? r.inviteExpiry.toISOString() : null,
  }));

  return <MembersManager initialMembers={initialMembers} />;
}
