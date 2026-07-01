import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { serializeCall } from '@/lib/serialize';
import { livekitConfigured, roomParticipantCounts } from '@/lib/livekit';

// GET /api/calls/active — the currently-live call(s), newest first, so any
// authenticated user's client can discover a call to join. Open to everyone
// (no invite gating yet this pass). Each call carries its live participant
// count, and calls with nobody connected are dropped — that's how a call that
// everyone has left stops advertising itself (there's no explicit "end" step
// yet, so an empty LiveKit room is the signal a call is really over).
export async function GET() {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const calls = await prisma.call.findMany({
    where: { status: 'active' },
    orderBy: { startedAt: 'desc' },
    include: { startedBy: { select: { name: true } } },
  });

  const counts = livekitConfigured
    ? await roomParticipantCounts().catch(() => new Map<string, number>())
    : new Map<string, number>();

  const live = calls
    .map((c) => ({ ...serializeCall(c), participants: counts.get(c.roomName) ?? 0 }))
    .filter((c) => c.participants > 0);

  return NextResponse.json({ calls: live });
}
