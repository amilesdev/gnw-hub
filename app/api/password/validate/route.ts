import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isResetExpired } from '@/lib/password-reset';

// GET /api/password/validate?token=... — public; checks a reset token exists and
// is unexpired (so the reset page can show the right state before asking for a
// new password). Never reveals the account's email.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.json({ valid: false, reason: 'missing' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { resetToken: token },
    select: { status: true, resetExpiry: true },
  });

  if (!user || user.status !== 'active') {
    return NextResponse.json({ valid: false, reason: 'invalid' }, { status: 404 });
  }
  if (isResetExpired(user.resetExpiry)) {
    return NextResponse.json({ valid: false, reason: 'expired' }, { status: 410 });
  }

  return NextResponse.json({ valid: true });
}
