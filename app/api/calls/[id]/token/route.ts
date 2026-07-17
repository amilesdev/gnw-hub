import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { createJoinToken, livekitConfigured, livekitUrl } from '@/lib/livekit';
import { canAccessCall } from '@/lib/calls';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/calls/[id]/token — any authenticated user requests a token to join
// an active call. Grants publish + subscribe, since join is open to everyone
// this pass. Returns the token plus the LiveKit server URL to connect to.
export async function POST(_req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  if (!livekitConfigured) {
    return NextResponse.json({ error: 'Calling is not configured on the server.' }, { status: 503 });
  }

  const call = await prisma.call.findUnique({ where: { id } });
  if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  if (call.status !== 'active') {
    return NextResponse.json({ error: 'This call has ended.' }, { status: 410 });
  }

  // Leaders-only calls are limited to designated call leaders (+ the starter).
  if (!(await canAccessCall(call, guard.user.id))) {
    return NextResponse.json({ error: 'This call is for leaders only.' }, { status: 403 });
  }

  // Carry the joiner's profile picture (if any) so other tiles can show it.
  const me = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: { image: true },
  });

  const token = await createJoinToken({
    room: call.roomName,
    identity: guard.user.id,
    name: guard.user.name ?? 'Member',
    metadata: JSON.stringify({ image: me?.image ?? null }),
  });

  // startedAt lets the client show the *total* call duration (since the leader
  // started it), not just how long this participant has been connected.
  return NextResponse.json({
    token,
    serverUrl: livekitUrl(),
    name: call.name,
    startedAt: call.startedAt.toISOString(),
  });
}
