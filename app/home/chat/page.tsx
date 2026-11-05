import { ChatListPage } from '@/components/chat/pages';

export const dynamic = 'force-dynamic';

export default function MemberChatPage() {
  return <ChatListPage base="/home" />;
}
