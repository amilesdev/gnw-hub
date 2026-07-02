import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { resetPasswordSchema } from '@/lib/validation';
import { isResetExpired } from '@/lib/password-reset';

// POST /api/password/reset — public; sets a new password from a valid reset
// token, clears the token, and bumps tokenVersion so every other logged-in
// session for this account is immediately invalidated. Returns the email so the
// client can sign in fresh (that new JWT carries the bumped version).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { resetToken: token } });

  if (!user || user.status !== 'active') {
    return NextResponse.json({ error: 'This reset link is no longer valid.' }, { status: 400 });
  }
  if (isResetExpired(user.resetExpiry)) {
    return NextResponse.json({ error: 'This reset link has expired. Request a new one.' }, { status: 410 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetExpiry: null,
      tokenVersion: { increment: 1 },
    },
  });

  return NextResponse.json({ ok: true, email: user.email });
}
