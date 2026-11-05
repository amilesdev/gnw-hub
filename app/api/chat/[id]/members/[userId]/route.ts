import { NextResponse, after } from 'next/server';
import { canModerateChat } from '@/lib/access';
import { requireChat } from '@/lib/chat/guard';
import { chatMemberIds, removeMember } from '@/lib/chat/server';
import { pingUsers } from '@/lib/chat/realtime-server';

type Ctx = { params: Promise<{ id: string; userId: string }> };

// DELETE /api/chat/[id]/members/[userId] — remove someone from the chat (and so
// its topics). Moderators only. Their past messages stay.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, userId } = await params;
  const guard = await requireChat(id);
  if ('error' in guard) return guard.error;
  if (!canModerateChat(guard.user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rootId = guard.access.root.id;
  const removed = await removeMember(rootId, userId);
  if (!removed) return NextResponse.json({ error: 'Not in this chat.' }, { status: 404 });
  // The removed person's list refreshes (the chat disappears) along with everyone else's.
  after(async () => pingUsers([...(await chatMemberIds(rootId)), userId], { kind: 'chats', chatId: rootId }));
  return NextResponse.json({ ok: true });
}
