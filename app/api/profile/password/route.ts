import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { decode, encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { changePasswordSchema } from '@/lib/validation';

// NextAuth's session cookie: `__Secure-` prefixed on https, plain on http (dev).
const SESSION_COOKIES = ['__Secure-next-auth.session-token', 'next-auth.session-token'];
// NextAuth's default JWT session lifetime (we don't override session.maxAge).
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

// POST /api/profile/password — change own password (any authenticated user).
//
// Changing the password signs out every OTHER session: tokenVersion is bumped,
// which invalidates every existing JWT (see the session callback in lib/auth.ts).
// The device making the change keeps working because this response re-issues
// its own session cookie with the new tokenVersion — only a caller who just
// proved the current password gets that, so a stolen session can't renew itself.
export async function POST(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: guard.user.id } });
  if (!user?.passwordHash) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });

  // Re-sign THIS device's session with the new tokenVersion.
  const secret = process.env.NEXTAUTH_SECRET;
  const jar = await cookies();
  const name = SESSION_COOKIES.find((n) => jar.get(n));
  const current = name && secret ? await decode({ token: jar.get(name)!.value, secret }).catch(() => null) : null;

  if (!name || !secret || !current || current.uid !== user.id) {
    // Couldn't renew (unexpected cookie shape). The password still changed and
    // every session — including this one — is signed out; the client sends the
    // user to sign in with the new password.
    return NextResponse.json({ ok: true, signedOut: true });
  }

  const token = await encode({ token: { ...current, tokenVersion: updated.tokenVersion }, secret, maxAge: SESSION_MAX_AGE });
  const res = NextResponse.json({ ok: true, signedOut: false });
  res.cookies.set(name, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: name.startsWith('__Secure-'),
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
