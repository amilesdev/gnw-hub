import { ChatThreadPage } from '@/components/chat/pages';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> };

export default async function LeaderChatThreadPage({ params, searchParams }: Props) {
  return <ChatThreadPage base="/dashboard" id={(await params).id} focus={(await searchParams).m} />;
}
