import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { canCreateChats, canUseChat } from '@/lib/access';
import { getChatAccess, getChatDetail, getChatList } from '@/lib/chat/server';
import { getMessages, getPins } from '@/lib/chat/messages';
import { ChatComingSoon } from '@/components/shared/ChatComingSoon';
import { ChatList } from './ChatList';
import { ChatThread } from './ChatThread';
import { ChatHub } from './ChatHub';

// Server bodies for the Chat routes, shared by /home/chat/* and /dashboard/chat/*
// (the route files only pick the base). Data loads here so a chat opens with
// its messages already painted; the client components take over live updates.
// Someone who can't use chat yet (canUseChat) gets "Coming Soon" on the tab
// and 404 on any chat (getChatAccess).

type Base = '/home' | '/dashboard';

export async function ChatListPage({ base }: { base: Base }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!canUseChat(user)) return <ChatComingSoon />;
  return <ChatList base={base} meId={user.id} initial={await getChatList(user)} canCreate={canCreateChats(user)} />;
}

/**
 * A chat's page (Main chat + topics). Only for a chat that has topics: a topic
 * id goes to its parent's page, and a chat with no topics goes straight in.
 */
export async function ChatHubPage({ base, id }: { base: Base; id: string }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const access = await getChatAccess(id, user);
  if (!access) notFound();
  if (access.chat.parentId) redirect(`${base}/chat/${access.chat.parentId}/topics`);
  const [list, detail] = await Promise.all([getChatList(user), getChatDetail(access, user)]);
  const item = [...list.chats, ...list.archived].find((c) => c.id === id);
  if (!item) notFound();
  if (item.topics.length === 0) redirect(`${base}/chat/${id}`);
  return <ChatHub key={id} base={base} meId={user.id} initialItem={item} initialDetail={detail} />;
}

/** `focus` (a search hit opened from elsewhere): open on that message instead of the latest. */
export async function ChatThreadPage({ base, id, focus }: { base: Base; id: string; focus?: string }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const access = await getChatAccess(id, user);
  if (!access) notFound();
  const [detail, focused, pins] = await Promise.all([
    getChatDetail(access, user),
    focus ? getMessages(access.chat.id, user.id, { around: focus }) : null,
    getPins(access.chat.id, user.id),
  ]);
  // A focus that isn't in this chat (deleted since, bad link) just opens the latest.
  const page = focused ?? (await getMessages(access.chat.id, user.id))!;
  return (
    <ChatThread
      // Keyed by chat: hopping between a chat and its topics is a fresh thread.
      key={`${detail.id}:${focused ? focus : ''}`}
      base={base}
      me={{ id: user.id, name: user.name?.trim() ?? '', image: user.image ?? null }}
      initialDetail={detail}
      initialPage={page}
      initialFocusId={focused ? focus : undefined}
      initialPins={pins}
    />
  );
}
