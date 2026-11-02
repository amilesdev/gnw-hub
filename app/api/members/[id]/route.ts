import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { editMemberSchema } from '@/lib/validation';
import { revalidateMembers } from '@/lib/cache-tags';

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

  // GNW Play hangs two RESTRICT foreign keys off rows this member may own, and
  // either one makes a bare user.delete() fail with a foreign-key error:
  //
  //   GameSession.hostId → User          — they have hosted a game
  //   GameSession.packId → QuestionPack  — a pack they wrote was played, which
  //     also blocks the QuestionPack.createdById → User cascade behind it
  //
  // Clearing those sessions first takes their players, answers, teams and round
  // state with them (all CASCADE), which in turn frees the pack cascade to run
  // with the user. Same shape as DELETE /api/play/packs/[packId], which already
  // has to clear finished sessions before it can drop a pack.
  const packIds = (
    await prisma.questionPack.findMany({ where: { createdById: id }, select: { id: true } })
  ).map((p) => p.id);

  await prisma.$transaction([
    prisma.gameSession.deleteMany({
      where: { OR: [{ hostId: id }, ...(packIds.length ? [{ packId: { in: packIds } }] : [])] },
    }),
    prisma.user.delete({ where: { id } }),
  ]);
  revalidateMembers();
  return NextResponse.json({ ok: true });
}
