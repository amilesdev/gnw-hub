import 'server-only';
import { prisma } from '@/lib/prisma';
import { sendPush } from '@/lib/push';
import { CHAT_USERS, chatMemberIds, type ChatAccess } from './server';
import { pingUsers } from './realtime-server';
import { CHAT_VIEWING_WINDOW_MS, chatTitle, type ChatMessageDTO } from './types';

const PREVIEW_MAX = 140;

/**
 * Everything that follows a new message, run after the response is sent
 * (`after()` in the route): ping every member's devices — the sender's too, so
 * their other phone/laptop updates — then push to members who should hear it.
 *
 * Push skips the sender and anyone looking at this chat right now (fresh
 * viewing heartbeat). Muting skips you too — except an @mention of you, or
 * @all, which break through mute (the user's call).
 */
export async function fanOutNewMessage(access: ChatAccess, message: ChatMessageDTO): Promise<void> {
  const { chat, root } = access;
  const members = await prisma.chatMember.findMany({
    where: { chatId: root.id, user: CHAT_USERS },
    select: { userId: true, mutedAt: true },
  });

  await pingUsers(
    members.map((m) => m.userId),
    { kind: 'message', chatId: chat.id, messageId: message.id },
  );

  const viewing = await prisma.chatReadState.findMany({
    where: { chatId: chat.id, viewingAt: { gt: new Date(Date.now() - CHAT_VIEWING_WINDOW_MS) } },
    select: { userId: true },
  });
  const looking = new Set(viewing.map((v) => v.userId));
  const mentioned = new Set(message.mentionIds);
  const eligible = members.filter((m) => m.userId !== message.author?.id && !looking.has(m.userId));

  const firstName = message.author?.name.split(' ')[0] ?? 'Someone';
  const title = chatTitle(chat.name, chat.parent?.name);
  const base = {
    // Role-neutral link: app/chat/[id] sends leaders to /dashboard, members to /home.
    url: `/chat/${chat.id}`,
    // One notification per chat — a busy chat replaces instead of stacking.
    tag: `chat:${chat.id}`,
  };

  const callOuts = eligible.filter((m) => message.mentionsAll || mentioned.has(m.userId)).map((m) => m.userId);
  const regular = eligible
    .filter((m) => m.mutedAt === null && !message.mentionsAll && !mentioned.has(m.userId))
    .map((m) => m.userId);

  await Promise.all([
    callOuts.length &&
      sendPush(
        { ...base, title: message.mentionsAll ? `${title} · @all` : `${firstName} mentioned you · ${title}`, body: preview(message, firstName) },
        callOuts,
      ),
    regular.length && sendPush({ ...base, title, body: preview(message, firstName) }, regular),
  ]);
}

/** Tell every member's devices a message changed (edit, delete, reaction, pin) — they refetch it. */
export async function pingMessageUpdate(access: ChatAccess, messageId: string): Promise<void> {
  await pingUsers(await chatMemberIds(access.root.id), { kind: 'update', chatId: access.chat.id, messageId });
}

function preview(message: ChatMessageDTO, firstName: string): string {
  const text = (message.text ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    const n = message.attachments.length;
    const video = message.attachments.some((a) => a.kind === 'video');
    return `${firstName} sent ${n > 1 ? `${n} ${video ? 'photos & videos' : 'photos'}` : video ? 'a video' : 'a photo'}`;
  }
  return `${firstName}: ${text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text}`;
}
