import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isInviteExpired } from '@/lib/invites';

// GET /api/invite/validate?token=... — public; checks token exists and is unexpired.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.json({ valid: false, reason: 'missing' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    select: { name: true, email: true, status: true, inviteExpiry: true },
  });

  if (!user || user.status === 'active') {
    return NextResponse.json({ valid: false, reason: 'invalid' }, { status: 404 });
  }
  if (isInviteExpired(user.inviteExpiry)) {
    return NextResponse.json({ valid: false, reason: 'expired' }, { status: 410 });
  }

  return NextResponse.json({ valid: true, name: user.name, email: user.email });
}
