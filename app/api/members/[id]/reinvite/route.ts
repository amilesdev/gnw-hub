import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { newInviteToken, inviteUrl } from '@/lib/invites';
import { sendInviteEmail } from '@/lib/email';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/members/[id]/reinvite — regenerate token + expiry and resend (leader only).
export async function POST(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  if (target.status === 'active') {
    return NextResponse.json({ error: 'Member has already claimed their account.' }, { status: 400 });
  }

  const { inviteToken, inviteExpiry } = newInviteToken();
  await prisma.user.update({ where: { id }, data: { inviteToken, inviteExpiry } });

  const emailResult = await sendInviteEmail({
    to: target.email,
    name: target.name,
    inviteUrl: inviteUrl(inviteToken),
  });

  return NextResponse.json({ ok: true, emailSkipped: emailResult.skipped ?? false });
}
