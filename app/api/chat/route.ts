import { NextResponse, after } from 'next/server';
import { canCreateChats } from '@/lib/access';
import { requireChatUser } from '@/lib/chat/guard';
import { createChat, getChatList } from '@/lib/chat/server';
import { pingUsers } from '@/lib/chat/realtime-server';
import { chatCreateSchema, firstIssue } from '@/lib/chat/validation';

// GET /api/chat — my chats (with topics), unread counts, last-message previews.
export async function GET() {
  const guard = await requireChatUser();
  if ('error' in guard) return guard.error;
  return NextResponse.json(await getChatList(guard.user));
}

// POST /api/chat — new chat { name, memberIds }. Super admin + leaders. The
// creator is always a member.
export async function POST(req: Request) {
  const guard = await requireChatUser();
  if ('error' in guard) return guard.error;
  if (!canCreateChats(guard.user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = chatCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const chat = await createChat(guard.user, parsed.data);
  after(() => pingUsers(chat.memberIds, { kind: 'chats' }));
  return NextResponse.json({ id: chat.id }, { status: 201 });
}
