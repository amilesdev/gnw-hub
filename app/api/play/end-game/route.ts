import { NextResponse } from 'next/server';
import { requireHost } from '@/lib/play/auth';
import { endGame } from '@/lib/play/engine';
import { sessionIdSchema } from '@/lib/play/validation';

// POST /api/play/end-game — host ends the game early (or cancels a lobby). Runs
// final scoring + Play Point award and broadcasts GAME_ENDED (spec §5.7, §7.4).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const guard = await requireHost(parsed.data.sessionId);
  if ('error' in guard) return guard.error;

  await endGame(parsed.data.sessionId);
  return NextResponse.json({ ok: true });
}
