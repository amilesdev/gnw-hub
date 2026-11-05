import { ChatListPage } from '@/components/chat/pages';

export const dynamic = 'force-dynamic';

export default function LeaderChatPage() {
  return <ChatListPage base="/dashboard" />;
}
