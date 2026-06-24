import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { changePasswordSchema } from '@/lib/validation';

// POST /api/profile/password — change own password (any authenticated user).
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
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
