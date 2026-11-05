import { NextResponse } from 'next/server';
import { canCreateChats } from '@/lib/access';
import { requireChatUser } from '@/lib/chat/guard';
import { listChatPeople } from '@/lib/chat/server';

// GET /api/chat/people — everyone who can be put in a chat, for the member
// pickers. Only for those who can create chats / add members.
export async function GET() {
  const guard = await requireChatUser();
  if ('error' in guard) return guard.error;
  if (!canCreateChats(guard.user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ people: await listChatPeople() });
}
