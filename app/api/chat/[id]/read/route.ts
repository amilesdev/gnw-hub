import { NextResponse, after } from 'next/server';
import { requireChat } from '@/lib/chat/guard';
import { markRead } from '@/lib/chat/server';
import { pingUsers } from '@/lib/chat/realtime-server';
import { chatReadSchema } from '@/lib/chat/validation';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/chat/[id]/read { viewing? } — mark read up to now. The open chat
// screen also calls this as its "I'm looking at it" heartbeat (viewing: true)
// and on leaving (viewing: false, via sendBeacon), which is what lets pushes
// skip whoever is already reading. Tells my other devices to refresh badges.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;

  // sendBeacon posts text/plain, so parse the body ourselves.
  const raw = await req.text().catch(() => '');
  let json: unknown = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    /* empty or bad body → plain mark-read */
  }
  const parsed = chatReadSchema.safeParse(json);
  const viewing = parsed.success ? parsed.data.viewing : undefined;

  await markRead(guard.access.chat.id, guard.user.id, viewing);
  after(() => pingUsers([guard.user.id], { kind: 'read', chatId: guard.access.chat.id }));
  return NextResponse.json({ ok: true });
}
