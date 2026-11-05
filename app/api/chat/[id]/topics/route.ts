import { NextResponse, after } from 'next/server';
import { canCreateChats } from '@/lib/access';
import { archivedError, requireChat } from '@/lib/chat/guard';
import { chatMemberIds, createTopic } from '@/lib/chat/server';
import { pingUsers } from '@/lib/chat/realtime-server';
import { chatTopicCreateSchema, firstIssue } from '@/lib/chat/validation';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/chat/[id]/topics { name } — new topic in this chat (or, from a
// topic, in its parent chat). Super admin + leaders. Topics are open to
// everyone in the chat.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  if (!canCreateChats(guard.user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const blocked = archivedError(guard.access);
  if (blocked) return blocked;

  const parsed = chatTopicCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const rootId = guard.access.root.id;
  const topic = await createTopic(rootId, guard.user, parsed.data.name);
  after(async () => pingUsers(await chatMemberIds(rootId), { kind: 'chats', chatId: topic.id }));
  return NextResponse.json({ id: topic.id }, { status: 201 });
}
