import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { editMemberSchema, partMatchesSection } from '@/lib/validation';
import { revalidateMembers } from '@/lib/cache-tags';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/members/[id] — edit name and voice part (leader only), and role
// (super-admin only).
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

  const { role, ...rest } = parsed.data;

  // Only the super-admin may change a role (same rule as POST /api/members), and
  // the super-admin's own role is fixed. An unchanged role is just ignored, so
  // the edit form can keep sending it.
  const roleChanges = role !== undefined && role !== target.role;
  if (roleChanges && !guard.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Only the super-admin can change someone’s role.' }, { status: 403 });
  }
  if (roleChanges && target.isSuperAdmin) {
    return NextResponse.json({ error: 'The super-admin’s role can’t be changed.' }, { status: 400 });
  }

  // Check the RESULTING section + part: changing only one of them must not leave
  // a part from the other section attached (e.g. Band with "Soprano").
  const section = rest.section ?? target.section;
  const part = rest.part ?? target.part;
  if (section && part && !partMatchesSection(section, part)) {
    return NextResponse.json({ error: 'Pick a part that matches the section.' }, { status: 400 });
  }

  const member = await prisma.user.update({
    where: { id },
    data: { ...rest, ...(roleChanges ? { role } : {}) },
    select: { id: true, name: true, email: true, role: true, section: true, part: true, status: true, inviteExpiry: true },
  });
  revalidateMembers();
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
  revalidateMembers();
  return NextResponse.json({ ok: true });
}
