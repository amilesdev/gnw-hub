import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { claimSchema } from '@/lib/validation';
import { isInviteExpired } from '@/lib/invites';
import { revalidateMembers } from '@/lib/cache-tags';

// POST /api/invite/claim — public; sets password, activates account, clears token.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { inviteToken: token } });

  if (!user || user.status === 'active') {
    return NextResponse.json({ error: 'This invite is no longer valid.' }, { status: 400 });
  }
  if (isInviteExpired(user.inviteExpiry)) {
    return NextResponse.json({ error: 'This invite has expired. Ask your leader for a new one.' }, { status: 410 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: 'active',
      inviteToken: null,
      inviteExpiry: null,
    },
  });

  // A pending invite just became active — refresh the leader's pending-invite count.
  revalidateMembers();

  // Client signs in with credentials after this resolves.
  return NextResponse.json({ ok: true, email: user.email });
}
