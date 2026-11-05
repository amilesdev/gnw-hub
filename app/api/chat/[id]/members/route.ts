import { NextResponse, after } from 'next/server';
import { canCreateChats } from '@/lib/access';
import { archivedError, requireChat } from '@/lib/chat/guard';
import { addMembers, chatMemberIds } from '@/lib/chat/server';
import { pingUsers } from '@/lib/chat/realtime-server';
import { chatMembersAddSchema, firstIssue } from '@/lib/chat/validation';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/chat/[id]/members { userIds } — add people to the chat (membership
// lives on the root, so from a topic this adds to its parent). Super admin +
// leaders. Removing people is moderation: see ./[userId]/route.ts.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  if (!canCreateChats(guard.user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const blocked = archivedError(guard.access);
  if (blocked) return blocked;

  const parsed = chatMembersAddSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const rootId = guard.access.root.id;
  await addMembers(rootId, parsed.data.userIds);
  after(async () => pingUsers(await chatMemberIds(rootId), { kind: 'chats', chatId: rootId }));
  return NextResponse.json({ ok: true });
}
