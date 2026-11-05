import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { archivedError, requireChat } from '@/lib/chat/guard';
import { chatMemberIds } from '@/lib/chat/server';
import { pingUsers } from '@/lib/chat/realtime-server';
import { CHAT_VIEWING_WINDOW_MS } from '@/lib/chat/types';
import { chatTypingSchema, firstIssue } from '@/lib/chat/validation';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/chat/[id]/typing { typing } — "I'm typing" / "I stopped". Nothing is
// stored: it's a content-free ping (who + where, never text) sent only to the
// members who have this chat or topic open right now (their viewing heartbeat
// is fresh). The composer re-sends it every few seconds while typing, and the
// receivers let it fade if the refreshes stop.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  const archived = archivedError(guard.access);
  if (archived) return archived;

  const parsed = chatTypingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const chatId = guard.access.chat.id;
  const me = guard.user.id;
  after(async () => {
    const [viewing, members] = await Promise.all([
      prisma.chatReadState.findMany({
        where: { chatId, userId: { not: me }, viewingAt: { gte: new Date(Date.now() - CHAT_VIEWING_WINDOW_MS) } },
        select: { userId: true },
      }),
      chatMemberIds(guard.access.root.id),
    ]);
    // A stale heartbeat from someone removed since mustn't still hear about this chat.
    const allowed = new Set(members);
    const to = viewing.map((v) => v.userId).filter((id) => allowed.has(id));
    await pingUsers(to, { kind: 'typing', chatId, userId: me, typing: parsed.data.typing });
  });
  return NextResponse.json({ ok: true });
}
