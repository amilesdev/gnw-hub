import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { prayerCallCreateSchema } from '@/lib/validation';
import { serializeCall } from '@/lib/serialize';
import { createJoinToken, ensureCallRoom, livekitConfigured, livekitUrl, newRoomName } from '@/lib/livekit';
import { sendPush } from '@/lib/push';
import { canStartPrayerCall, isPrayerCallOpen } from '@/lib/prayer-call';

// POST /api/calls/prayer — one of the designated people starts a call for a
// Prayer event from its card. Unlike /api/calls (leaders only), this is gated by
// an explicit name allowlist plus the event's own time window, so non-leaders on
// the list can start it — and only around the actual gathering. Always calls the
// whole team (all_members). Notifies everyone with "<name> started Prayer call".
export async function POST(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  if (!canStartPrayerCall(guard.user.name)) {
    return NextResponse.json({ error: 'Not allowed to start a prayer call.' }, { status: 403 });
  }

  if (!livekitConfigured) {
    return NextResponse.json({ error: 'Calling is not configured on the server.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = prayerCallCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: parsed.data.eventId } });
  if (!event || event.type !== 'prayer') {
    return NextResponse.json({ error: 'Prayer event not found.' }, { status: 404 });
  }

  // Enforce the same window the button uses client-side, authoritatively.
  const dateYmd = event.date.toISOString().slice(0, 10);
  if (!isPrayerCallOpen(dateYmd, event.time)) {
    return NextResponse.json({ error: 'The prayer call window is not open.' }, { status: 409 });
  }

  const call = await prisma.call.create({
    data: {
      name: event.eventName,
      audience: 'all_members',
      roomName: newRoomName(),
      startedById: guard.user.id,
    },
  });

  // Provision the room up front with a short empty-timeout (best-effort — it's
  // also created lazily on first connect).
  await ensureCallRoom(call.roomName).catch(() => {});

  const token = await createJoinToken({
    room: call.roomName,
    identity: guard.user.id,
    name: guard.user.name ?? 'Leader',
  });

  // Fan out to the whole team. Best-effort — a push failure shouldn't fail the call.
  const firstName = (guard.user.name ?? '').split(' ')[0] || 'Someone';
  await sendPush({
    title: `${firstName} started Prayer call`,
    body: event.eventName,
    url: `/call/${call.id}`,
    tag: `call-${call.id}`,
  }).catch(() => {});

  return NextResponse.json(
    { call: serializeCall(call), token, serverUrl: livekitUrl() },
    { status: 201 },
  );
}
