import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canMentionAll, canModerateChat } from '@/lib/access';
import {
  CHAT_AROUND_SIDE,
  CHAT_CATCHUP_MAX,
  CHAT_MAX_ATTACHMENTS,
  CHAT_MEDIA_MAX_BYTES,
  CHAT_PAGE_SIZE,
  withinEditWindow,
  type ChatAttachmentInput,
  type ChatMessageDTO,
  type ChatMessagesPageDTO,
  type ChatReactionDTO,
} from './types';
import { deleteChatObjects, isOwnChatUpload, signChatReads } from './storage';
import type { ChatAccess, ChatViewer } from './server';

// Messages: reading pages, sending, and the per-message actions (edit, delete,
// pin, react). Callers have already resolved ChatAccess (membership); the
// rules for WHICH member may do what are enforced here, not in the UI.

const messageInclude = {
  author: { select: { id: true, name: true, image: true } },
  pinnedBy: { select: { name: true } },
  replyTo: {
    select: {
      id: true,
      text: true,
      deletedAt: true,
      importedAuthorName: true,
      author: { select: { name: true } },
      attachments: { select: { kind: true, path: true, posterPath: true }, orderBy: { position: 'asc' }, take: 1 },
    },
  },
  reactions: {
    select: { emoji: true, userId: true, user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  },
  mentions: { select: { userId: true } },
  attachments: { orderBy: { position: 'asc' } },
} satisfies Prisma.ChatMessageInclude;

type MessageRow = Prisma.ChatMessageGetPayload<{ include: typeof messageInclude }>;

/** A replied-to message's still: its first photo, or that video's poster. */
function replyThumbPath(m: MessageRow): string | null {
  const a = m.deletedAt || !m.replyTo || m.replyTo.deletedAt ? undefined : m.replyTo.attachments[0];
  if (!a) return null;
  return a.kind === 'image' ? a.path : a.posterPath;
}

/** Serialize rows for one viewer, signing every attachment URL (and reply thumbnail) in a single storage call. */
export async function serializeMessages(rows: MessageRow[], viewerId: string): Promise<ChatMessageDTO[]> {
  const paths = rows.flatMap((m) => [
    ...(m.deletedAt ? [] : m.attachments.flatMap((a) => [a.path, a.posterPath ?? ''])),
    replyThumbPath(m) ?? '',
  ]);
  const signed = await signChatReads(paths);

  return rows.map((m) => {
    const deleted = m.deletedAt !== null;
    const reactions = new Map<string, ChatReactionDTO>();
    if (!deleted) {
      for (const r of m.reactions) {
        const entry = reactions.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] };
        entry.count++;
        if (r.userId === viewerId) entry.mine = true;
        entry.names.push(r.user?.name.trim() ?? 'Former member');
        reactions.set(r.emoji, entry);
      }
    }
    const rt = m.replyTo;
    const thumbPath = replyThumbPath(m);
    return {
      id: m.id,
      chatId: m.chatId,
      author: m.author ? { id: m.author.id, name: m.author.name.trim(), image: m.author.image } : null,
      importedAuthorName: m.importedAuthorName,
      importedAuthorAvatar: m.importedAuthorAvatar,
      text: deleted ? null : m.text,
      createdAt: m.createdAt.toISOString(),
      editedAt: m.editedAt?.toISOString() ?? null,
      deleted,
      replyToId: m.replyToId,
      replyTo:
        rt && !deleted
          ? {
              id: rt.id,
              authorName: rt.author?.name.trim() ?? rt.importedAuthorName,
              text: rt.deletedAt ? null : rt.text,
              deleted: rt.deletedAt !== null,
              media: rt.deletedAt ? null : (rt.attachments[0]?.kind ?? null),
              thumbUrl: thumbPath ? (signed.get(thumbPath) ?? null) : null,
            }
          : null,
      pinnedAt: m.pinnedAt?.toISOString() ?? null,
      pinnedByName: m.pinnedBy?.name.trim() ?? null,
      mentionsAll: m.mentionsAll,
      mentionIds: deleted ? [] : m.mentions.map((x) => x.userId),
      reactions: [...reactions.values()],
      attachments: deleted
        ? []
        : m.attachments
            .filter((a) => signed.has(a.path))
            .map((a) => ({
              id: a.id,
              kind: a.kind,
              url: signed.get(a.path)!,
              posterUrl: a.posterPath ? (signed.get(a.posterPath) ?? null) : null,
              width: a.width,
              height: a.height,
              durationSec: a.durationSec,
              ...(a.kind === 'file' ? { name: a.name, sizeBytes: a.sizeBytes } : {}),
            })),
      clientNonce: m.clientNonce,
    };
  });
}

async function serializeOne(row: MessageRow, viewerId: string): Promise<ChatMessageDTO> {
  return (await serializeMessages([row], viewerId))[0];
}

/**
 * A page of messages, always returned oldest → newest.
 *  - default: the newest page
 *  - before: the page older than that message (scrolling up)
 *  - after:  everything newer than that message (catch-up), capped
 *  - around: that message with CHAT_AROUND_SIDE on each side (jumping to a
 *            search hit or a reply's original); null if it isn't in this chat
 */
export async function getMessages(
  chatId: string,
  viewerId: string,
  { before, after, around }: { before?: string; after?: string; around?: string } = {},
): Promise<ChatMessagesPageDTO | null> {
  const pivotId = around ?? after ?? before;
  const pivot = pivotId
    ? await prisma.chatMessage.findFirst({ where: { id: pivotId, chatId }, select: { id: true, createdAt: true } })
    : null;

  if (around) {
    if (!pivot) return null;
    const [older, newer] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { chatId, OR: [{ createdAt: { lt: pivot.createdAt } }, { createdAt: pivot.createdAt, id: { lt: pivot.id } }] },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: CHAT_AROUND_SIDE + 1,
        include: messageInclude,
      }),
      // Includes the pivot itself.
      prisma.chatMessage.findMany({
        where: { chatId, OR: [{ createdAt: { gt: pivot.createdAt } }, { createdAt: pivot.createdAt, id: { gte: pivot.id } }] },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: CHAT_AROUND_SIDE + 2,
        include: messageInclude,
      }),
    ]);
    return {
      messages: await serializeMessages(
        [...older.slice(0, CHAT_AROUND_SIDE).reverse(), ...newer.slice(0, CHAT_AROUND_SIDE + 1)],
        viewerId,
      ),
      hasMore: older.length > CHAT_AROUND_SIDE,
      hasNewer: newer.length > CHAT_AROUND_SIDE + 1,
    };
  }

  if (after && pivot) {
    const rows = await prisma.chatMessage.findMany({
      where: {
        chatId,
        OR: [{ createdAt: { gt: pivot.createdAt } }, { createdAt: pivot.createdAt, id: { gt: pivot.id } }],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: CHAT_CATCHUP_MAX + 1,
      include: messageInclude,
    });
    return {
      messages: await serializeMessages(rows.slice(0, CHAT_CATCHUP_MAX), viewerId),
      hasMore: rows.length > CHAT_CATCHUP_MAX,
    };
  }

  const rows = await prisma.chatMessage.findMany({
    where: {
      chatId,
      ...(before && pivot
        ? { OR: [{ createdAt: { lt: pivot.createdAt } }, { createdAt: pivot.createdAt, id: { lt: pivot.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: CHAT_PAGE_SIZE + 1,
    include: messageInclude,
  });
  return {
    messages: await serializeMessages(rows.slice(0, CHAT_PAGE_SIZE).reverse(), viewerId),
    hasMore: rows.length > CHAT_PAGE_SIZE,
  };
}

export async function getMessage(chatId: string, messageId: string, viewerId: string): Promise<ChatMessageDTO | null> {
  const row = await prisma.chatMessage.findFirst({ where: { id: messageId, chatId }, include: messageInclude });
  return row ? serializeOne(row, viewerId) : null;
}

/** Pinned messages, most recently pinned first. */
export async function getPins(chatId: string, viewerId: string): Promise<ChatMessageDTO[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { chatId, pinnedAt: { not: null }, deletedAt: null },
    orderBy: { pinnedAt: 'desc' },
    take: 50,
    include: messageInclude,
  });
  return serializeMessages(rows, viewerId);
}

// ── Sending ──────────────────────────────────────────────────────────────────

export class ChatInputError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export type SendInput = {
  text?: string;
  clientNonce?: string;
  replyToId?: string;
  mentionIds?: string[];
  mentionsAll?: boolean;
  attachments?: ChatAttachmentInput[];
};

/**
 * Post a message: text and/or photos/videos, optionally a reply, @mentions and
 * @all. Idempotent on clientNonce: a retried send (flaky phone network) returns
 * the message it already created instead of posting twice.
 */
export async function sendMessage(
  access: ChatAccess,
  viewer: ChatViewer,
  input: SendInput,
): Promise<{ message: ChatMessageDTO; created: boolean }> {
  const chatId = access.chat.id;
  const rootId = access.root.id;
  const text = input.text?.trim() || null;
  const attachments = input.attachments ?? [];
  const clientNonce = input.clientNonce ?? null;

  if (!text && attachments.length === 0) throw new ChatInputError('Type a message.');
  if (attachments.length > CHAT_MAX_ATTACHMENTS) {
    throw new ChatInputError(`Up to ${CHAT_MAX_ATTACHMENTS} files per message.`);
  }
  for (const a of attachments) {
    // Only files this person uploaded to this chat (see lib/chat/storage.ts).
    if (!isOwnChatUpload(a.path, rootId, viewer.id) || (a.posterPath && !isOwnChatUpload(a.posterPath, rootId, viewer.id))) {
      throw new ChatInputError('That file wasn’t uploaded to this chat.', 403);
    }
    // A PDF is stored as one (signed upload paths end in the type's extension).
    if ((a.kind === 'file') !== a.path.endsWith('.pdf')) throw new ChatInputError('Only photos, videos and PDFs can be shared.');
    if (a.sizeBytes > CHAT_MEDIA_MAX_BYTES) throw new ChatInputError('Each file can be up to 100 MB.');
  }
  if (input.mentionsAll && !canMentionAll(viewer)) {
    throw new ChatInputError('Only leaders and moderators can @all.', 403);
  }

  const [replyTo, mentionable] = await Promise.all([
    input.replyToId
      ? prisma.chatMessage.findFirst({ where: { id: input.replyToId, chatId }, select: { id: true } })
      : null,
    input.mentionIds?.length
      ? prisma.chatMember.findMany({
          where: { chatId: rootId, userId: { in: input.mentionIds.filter((id) => id !== viewer.id) } },
          select: { userId: true },
        })
      : [],
  ]);
  if (input.replyToId && !replyTo) throw new ChatInputError('The message you replied to is gone.');

  // One batched transaction (not an interactive one): every round trip to the
  // pooled DB is felt in send latency. A retry is caught by clientNonce's
  // unique index below rather than checked for up front.
  const now = new Date();
  try {
    const [created] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          chatId,
          authorId: viewer.id,
          text,
          clientNonce,
          createdAt: now,
          replyToId: replyTo?.id ?? null,
          mentionsAll: !!input.mentionsAll,
          mentions: { createMany: { data: mentionable.map((m) => ({ userId: m.userId })) } },
          attachments: {
            createMany: {
              data: attachments.map((a, position) => ({
                kind: a.kind,
                path: a.path,
                name: a.kind === 'file' ? (a.name ?? null) : null,
                posterPath: a.posterPath ?? null,
                width: a.width ?? null,
                height: a.height ?? null,
                durationSec: a.durationSec ?? null,
                sizeBytes: a.sizeBytes,
                position,
              })),
            },
          },
        },
        include: messageInclude,
      }),
      prisma.chat.update({ where: { id: chatId }, data: { lastMessageAt: now } }),
      // Your own message is read by definition.
      prisma.chatReadState.upsert({
        where: { chatId_userId: { chatId, userId: viewer.id } },
        create: { chatId, userId: viewer.id, lastReadAt: now },
        update: { lastReadAt: now },
      }),
    ]);
    return { message: await serializeOne(created, viewer.id), created: true };
  } catch (err) {
    // A retry (or two copies of one send racing): return the message that won.
    if (clientNonce && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.chatMessage.findUnique({ where: { clientNonce }, include: messageInclude });
      if (existing && existing.authorId === viewer.id) return { message: await serializeOne(existing, viewer.id), created: false };
    }
    throw err;
  }
}

// ── Per-message actions ──────────────────────────────────────────────────────

async function findMessage(access: ChatAccess, messageId: string) {
  const m = await prisma.chatMessage.findFirst({
    where: { id: messageId, chatId: access.chat.id },
    select: { id: true, authorId: true, createdAt: true, deletedAt: true, text: true, _count: { select: { attachments: true } } },
  });
  if (!m) throw new ChatInputError('Message not found.', 404);
  return m;
}

/** Edit your own message's text, within 15 minutes of sending. */
export async function editMessage(access: ChatAccess, viewer: ChatViewer, messageId: string, text: string) {
  const m = await findMessage(access, messageId);
  if (m.authorId !== viewer.id) throw new ChatInputError('You can only edit your own messages.', 403);
  if (m.deletedAt) throw new ChatInputError('That message was deleted.', 409);
  if (!withinEditWindow(m.createdAt)) throw new ChatInputError('Messages can only be edited for 15 minutes.', 409);
  const next = text.trim();
  if (!next && m._count.attachments === 0) throw new ChatInputError('Type a message.');
  if ((next || null) === m.text) return;
  await prisma.chatMessage.update({ where: { id: m.id }, data: { text: next || null, editedAt: new Date() } });
}

/**
 * Delete a message: your own anytime, anyone's if you moderate. The row stays
 * (shown as "message deleted", replies keep their anchor) but its text, media,
 * reactions, mentions and pin go — the files are removed from storage too.
 */
export async function deleteMessage(access: ChatAccess, viewer: ChatViewer, messageId: string) {
  const m = await findMessage(access, messageId);
  if (m.authorId !== viewer.id && !canModerateChat(viewer)) {
    throw new ChatInputError('You can only delete your own messages.', 403);
  }
  if (m.deletedAt) return;
  const files = await prisma.chatAttachment.findMany({ where: { messageId: m.id }, select: { path: true, posterPath: true } });
  await prisma.$transaction([
    prisma.chatAttachment.deleteMany({ where: { messageId: m.id } }),
    prisma.chatReaction.deleteMany({ where: { messageId: m.id } }),
    prisma.chatMention.deleteMany({ where: { messageId: m.id } }),
    prisma.chatMessage.update({
      where: { id: m.id },
      data: { deletedAt: new Date(), deletedById: viewer.id, text: null, mentionsAll: false, pinnedAt: null, pinnedById: null },
    }),
  ]);
  await deleteChatObjects(files.flatMap((f) => [f.path, f.posterPath ?? '']));
}

/** Pin / unpin — anyone in the chat. */
export async function setPinned(access: ChatAccess, viewer: ChatViewer, messageId: string, pinned: boolean) {
  const m = await findMessage(access, messageId);
  if (m.deletedAt) throw new ChatInputError('That message was deleted.', 409);
  await prisma.chatMessage.update({
    where: { id: m.id },
    data: pinned ? { pinnedAt: new Date(), pinnedById: viewer.id } : { pinnedAt: null, pinnedById: null },
  });
}

/** Add or remove your reaction. */
export async function setReaction(access: ChatAccess, viewer: ChatViewer, messageId: string, emoji: string, on: boolean) {
  const m = await findMessage(access, messageId);
  if (m.deletedAt) throw new ChatInputError('That message was deleted.', 409);
  if (on) {
    await prisma.chatReaction.createMany({ data: [{ messageId: m.id, userId: viewer.id, emoji }], skipDuplicates: true });
  } else {
    await prisma.chatReaction.deleteMany({ where: { messageId: m.id, userId: viewer.id, emoji } });
  }
}
