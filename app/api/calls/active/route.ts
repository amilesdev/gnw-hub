import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { serializeCall } from '@/lib/serialize';
import { livekitConfigured, roomParticipantCounts } from '@/lib/livekit';
import { isCallLeader } from '@/lib/calls';

// Grace period after a call starts before an empty room counts as "over" — long
// enough for the leader to actually connect after creating it, so we don't end a
// call in the seconds between the DB row and the first participant joining.
const START_GRACE_MS = 15_000;

// GET /api/calls/active — the currently-live call(s), newest first, so any
// authenticated user's client can discover a call to join. Open to everyone
// (no invite gating yet this pass). Each call carries its live participant
// count. A call whose room has been empty past the start grace is marked
// `ended` here (and dropped) — that's the auto-end: once everyone leaves, the
// LiveKit room closes after its empty-timeout and the next poll retires the row.
export async function GET() {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const calls = await prisma.call.findMany({
    where: { status: 'active' },
    orderBy: { startedAt: 'desc' },
    include: { startedBy: { select: { name: true } } },
  });

  // A failed lookup must NOT look like "every room is empty", or one LiveKit blip
  // would retire every live call below. Answer 503 instead and end nothing; the
  // banner keeps showing what it last had and retries on its next poll.
  let counts = new Map<string, number>();
  if (livekitConfigured) {
    try {
      counts = await roomParticipantCounts();
    } catch (err) {
      console.error('[calls/active] LiveKit participant lookup failed', err);
      return NextResponse.json({ error: 'Call status is temporarily unavailable' }, { status: 503 });
    }
  }

  const now = Date.now();
  const withCounts = calls.map((c) => ({
    call: c,
    participants: counts.get(c.roomName) ?? 0,
  }));

  // Retire calls that are empty and past the start grace. We only get here with
  // real counts from LiveKit (a failed lookup returned 503 above).
  const toEnd = livekitConfigured
    ? withCounts
        .filter((c) => c.participants === 0 && now - c.call.startedAt.getTime() > START_GRACE_MS)
        .map((c) => c.call.id)
    : [];
  if (toEnd.length > 0) {
    await prisma.call
      .updateMany({
        where: { id: { in: toEnd }, status: 'active' },
        data: { status: 'ended', endedAt: new Date() },
      })
      .catch(() => {});
  }

  // Discovery gating: everyone sees all-members calls; a leaders-only call only
  // surfaces to designated call leaders (or whoever started it). The lookup runs
  // once, and only when a leaders-only call is actually live.
  const hasLeadersOnly = withCounts.some(
    (c) => c.participants > 0 && c.call.audience === 'leaders_only',
  );
  const iAmCallLeader = hasLeadersOnly ? await isCallLeader(guard.user.id) : false;

  const live = withCounts
    .filter((c) => c.participants > 0)
    .filter(
      (c) =>
        c.call.audience === 'all_members' ||
        iAmCallLeader ||
        c.call.startedById === guard.user.id,
    )
    .map((c) => ({ ...serializeCall(c.call), participants: c.participants }));

  return NextResponse.json({ calls: live });
}
