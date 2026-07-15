import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { callCreateSchema } from '@/lib/validation';
import { serializeCall } from '@/lib/serialize';
import { createJoinToken, ensureCallRoom, livekitConfigured, livekitUrl, newRoomName } from '@/lib/livekit';
import { sendPush } from '@/lib/push';
import { callLeaderIds } from '@/lib/calls';

// POST /api/calls — leader starts a new call. Creates the Call row + a LiveKit
// room name, fans out a push notification to the whole team, and returns a join
// token so the leader connects as the first participant. The LiveKit room itself
// is created lazily on first connect, so there's nothing else to provision here.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  if (!livekitConfigured) {
    return NextResponse.json({ error: 'Calling is not configured on the server.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = callCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const call = await prisma.call.create({
    data: {
      name: parsed.data.name,
      audience: parsed.data.audience,
      roomName: newRoomName(),
      startedById: guard.user.id,
    },
  });

  // Provision the room up front with a short empty-timeout so it auto-closes
  // soon after the last person leaves. Best-effort — the room is also created
  // lazily on first connect if this fails.
  await ensureCallRoom(call.roomName).catch(() => {});

  const token = await createJoinToken({
    room: call.roomName,
    identity: guard.user.id,
    name: guard.user.name ?? 'Leader',
  });

  // Notify the audience. An all-members call fans out to the whole team; a
  // leaders-only call goes only to the designated call leaders (an empty list
  // until any are assigned, so no one is pinged until then). Best-effort — a
  // push failure shouldn't fail the call.
  const pushTargets =
    call.audience === 'leaders_only' ? await callLeaderIds().catch(() => []) : undefined;
  await sendPush(
    {
      title: 'Started a Call',
      body: call.name,
      url: `/call/${call.id}`,
      tag: `call-${call.id}`,
    },
    pushTargets,
  ).catch(() => {});

  return NextResponse.json(
    { call: serializeCall(call), token, serverUrl: livekitUrl() },
    { status: 201 },
  );
}
