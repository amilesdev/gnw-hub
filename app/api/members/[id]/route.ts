import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { editMemberSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/members/[id] — edit name, voice part, and/or role (leader only).
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = editMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // Any leader may edit any member's role — including the super-admin's.
  const member = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, section: true, part: true, status: true, inviteExpiry: true },
  });
  return NextResponse.json({ member });
}

// DELETE /api/members/[id] — remove a member or revoke a pending invite (leader only).
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  if (target.isSuperAdmin) {
    return NextResponse.json({ error: 'The super-admin account cannot be removed.' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
