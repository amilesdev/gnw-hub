import { NextResponse } from 'next/server';
import { requireChat } from '@/lib/chat/guard';
import { getPins } from '@/lib/chat/messages';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/chat/[id]/pins — this chat's pinned messages, newest pin first.
export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  return NextResponse.json({ pins: await getPins(guard.access.chat.id, guard.user.id) });
}
