import { ChatHubPage } from '@/components/chat/pages';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function MemberChatHubPage({ params }: Props) {
  return <ChatHubPage base="/home" id={(await params).id} />;
}
