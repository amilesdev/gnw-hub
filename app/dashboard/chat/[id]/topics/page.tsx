import { ChatHubPage } from '@/components/chat/pages';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function LeaderChatHubPage({ params }: Props) {
  return <ChatHubPage base="/dashboard" id={(await params).id} />;
}
