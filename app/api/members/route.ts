import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { inviteSchema } from '@/lib/validation';
import { newInviteToken, inviteUrl } from '@/lib/invites';
import { sendInviteEmail } from '@/lib/email';

// GET /api/members — full member + pending-invite list (leader only).
export async function GET() {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const members = await prisma.user.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      section: true,
      part: true,
      status: true,
      isSuperAdmin: true,
      inviteExpiry: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ members });
}

// POST /api/members — invite a new member (leader only).
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { name, email, section, part } = parsed.data;
  const emailNorm = email.toLowerCase().trim();

  // Only the super-admin may grant the leader role; everyone else defaults to member.
  const role = guard.user.isSuperAdmin ? parsed.data.role : 'member';

  const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (existing) {
    return NextResponse.json({ error: 'A user with that email already exists.' }, { status: 409 });
  }

  const { inviteToken, inviteExpiry } = newInviteToken();

  const member = await prisma.user.create({
    data: {
      name,
      email: emailNorm,
      role,
      section,
      part,
      status: 'pending',
      inviteToken,
      inviteExpiry,
    },
    select: { id: true, name: true, email: true, role: true, section: true, part: true, status: true, inviteExpiry: true },
  });

  const emailResult = await sendInviteEmail({ to: emailNorm, name, inviteUrl: inviteUrl(inviteToken) });

  return NextResponse.json({ member, emailSkipped: emailResult.skipped ?? false }, { status: 201 });
}
