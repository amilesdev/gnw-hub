import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { forgotPasswordSchema } from '@/lib/validation';
import { newResetToken, resetUrl, RESET_TTL_MINUTES } from '@/lib/password-reset';
import { sendPasswordResetEmail } from '@/lib/email';

// Best-effort per-email cooldown so the endpoint can't be used to spam someone's
// inbox (or burn the Resend quota). In-memory / per-instance — fine as a soft
// throttle; not a security boundary.
const COOLDOWN_MS = 60_000;
const lastSent = new Map<string, number>();

// POST /api/password/forgot — public. Emails a reset link to an active account.
// Always responds { ok: true } regardless of whether the email exists, so it
// can't be used to discover which addresses have accounts.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const now = Date.now();
  const prev = lastSent.get(email);

  if (!prev || now - prev > COOLDOWN_MS) {
    lastSent.set(email, now);
    const user = await prisma.user.findUnique({ where: { email } });

    // Only active accounts with a password can reset. A pending invite has its
    // own claim flow, so we don't cross the wires.
    if (user && user.status === 'active' && user.passwordHash) {
      const { resetToken, resetExpiry } = newResetToken();
      await prisma.user.update({ where: { id: user.id }, data: { resetToken, resetExpiry } });
      await sendPasswordResetEmail({
        to: email,
        name: user.name,
        resetUrl: resetUrl(resetToken),
        ttlMinutes: RESET_TTL_MINUTES,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
