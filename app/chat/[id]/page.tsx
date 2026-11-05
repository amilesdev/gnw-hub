import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { canUseChat } from '@/lib/access';

// Role-neutral link target for chat pushes: sends leaders to the dashboard copy
// of the chat and members to theirs. Someone who can't use chat yet lands on
// the Chat tab ("Coming Soon").
type Props = { params: Promise<{ id: string }> };

export default async function ChatRedirect({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!canUseChat(user)) redirect('/home/chat');
  const { id } = await params;
  redirect(`${user.role === 'leader' ? '/dashboard' : '/home'}/chat/${encodeURIComponent(id)}`);
}
