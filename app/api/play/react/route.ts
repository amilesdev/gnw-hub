import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActor, getActorPlayer } from '@/lib/play/auth';
import { broadcast } from '@/lib/play/realtime-server';

// Mirror of the client EMOJIS set (kept inline so a server route never imports a
// 'use client' module).
const EMOJIS = ['🎉', '😂', '🔥', '❤️', '👀', '😮'];

const schema = z.object({
  sessionId: z.string().min(1),
  emoji: z.string().min(1),
  playerId: z.string().min(1),
});

// POST /api/play/react — broadcast an emoji reaction to everyone in the session.
// Any actor in the session may react (including eliminated spectators).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  if (!EMOJIS.includes(parsed.data.emoji)) {
    return NextResponse.json({ error: 'Unknown emoji' }, { status: 400 });
  }

  const actor = await getActor(parsed.data.sessionId);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const player = await getActorPlayer(parsed.data.sessionId, actor);
  if (!player) return NextResponse.json({ error: 'Not in this game' }, { status: 403 });

  await broadcast(parsed.data.sessionId, {
    type: 'REACTION',
    emoji: parsed.data.emoji,
    playerId: player.id,
  });
  return NextResponse.json({ ok: true });
}
