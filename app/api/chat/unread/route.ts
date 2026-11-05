import { NextResponse } from 'next/server';
import { requireChatUser } from '@/lib/chat/guard';
import { getChatList } from '@/lib/chat/server';

// GET /api/chat/unread — just the nav badge total (unread across unmuted chats).
export async function GET() {
  const guard = await requireChatUser();
  if ('error' in guard) return guard.error;
  const { unreadTotal } = await getChatList(guard.user);
  return NextResponse.json({ unreadTotal });
}
