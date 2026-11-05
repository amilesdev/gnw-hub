import 'server-only';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  CHAT_OPEN_TO_MEMBERS,
  canCreateChats,
  canMentionAll,
  canModerateChat,
  canUseChat,
  type Viewer,
} from '@/lib/access';
import { deleteChatObjects } from './storage';
import type { ChatDetailDTO, ChatListDTO, ChatListItemDTO, ChatMediaKind, ChatPersonDTO } from './types';

// Chat data access: who can see what, the chat list, one chat's details, and
// admin. Messages themselves live in ./messages.ts. Every read/write that
// takes a chat goes through getChatAccess first — membership of the root chat
// is the whole permission model for seeing a chat (moderation and creation are
// layered on top via lib/access.ts). See Docs/Chat-Feature.md.

export type ChatViewer = Viewer & { id: string };

/**
 * `canUseChat` as a User filter: who can be put in a chat, and who gets its
 * pings and pushes. During the soft launch that's leaders + moderators +
 * early-access testers, so a member can't be added by accident, and anyone
 * still in a chat after losing the leader role stops hearing from it.
 */
export const CHAT_USERS: Prisma.UserWhereInput = CHAT_OPEN_TO_MEMBERS
  ? {}
  : { OR: [{ role: 'leader' }, { isSuperAdmin: true }, { chatModerator: true }, { chatEarlyAccess: true }] };

/**
 * Resolve a chat or topic for a viewer. Null (→ 404) unless they're a member of
 * the root chat. Archived chats/topics are visible to moderators only (so they
 * can restore one) and are read-only for everyone.
 */
export async function getChatAccess(chatId: string, viewer: ChatViewer) {
  if (!canUseChat(viewer)) return null;
  // One query: the chat, its parent, and the viewer's membership of whichever is the root.
  const mine = { where: { userId: viewer.id } };
  const row = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { members: mine, parent: { include: { members: mine } } },
  });
  if (!row) return null;
  const { members, parent: parentRow, ...rest } = row;
  const parent = parentRow ? (({ members: _m, ...p }) => p)(parentRow) : null;
  const chat = { ...rest, parent };
  const root = parent ?? chat;
  const membership = (parentRow ? parentRow.members : members)[0];
  if (!membership) return null;
  const archived = chat.archivedAt !== null || root.archivedAt !== null;
  if (archived && !canModerateChat(viewer)) return null;
  return { chat, root, membership, archived };
}

export type ChatAccess = NonNullable<Awaited<ReturnType<typeof getChatAccess>>>;

/** Member ids of a root chat (everyone who can see it and its topics). */
export async function chatMemberIds(rootId: string): Promise<string[]> {
  const rows = await prisma.chatMember.findMany({
    where: { chatId: rootId, user: CHAT_USERS },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

// ── Chat list ────────────────────────────────────────────────────────────────

type ListNode = {
  id: string;
  name: string;
  parentId: string | null;
  muted: boolean;
  archived: boolean;
  /** Unread counts messages after this (last read, or joining if never read). */
  since: Date;
  lastMessageAt: Date | null;
  createdAt: Date;
  position: number;
};

/** The viewer's chats with their topics, unread counts and last-message previews. */
export async function getChatList(viewer: ChatViewer): Promise<ChatListDTO> {
  const moderator = canModerateChat(viewer);
  const memberships = await prisma.chatMember.findMany({
    where: { userId: viewer.id, chat: { parentId: null } },
    include: { chat: { include: { topics: true } } },
  });

  const nodes: ListNode[] = [];
  for (const m of memberships) {
    const root = m.chat;
    const archived = root.archivedAt !== null;
    if (archived && !moderator) continue;
    const muted = m.mutedAt !== null;
    nodes.push({ ...pick(root), parentId: null, muted, archived, since: m.joinedAt });
    for (const t of root.topics) {
      if (t.archivedAt !== null) continue;
      nodes.push({ ...pick(t), parentId: root.id, muted, archived, since: m.joinedAt });
    }
  }
  if (nodes.length === 0) return { chats: [], archived: [], unreadTotal: 0 };

  const ids = nodes.map((n) => n.id);
  const reads = await prisma.chatReadState.findMany({
    where: { userId: viewer.id, chatId: { in: ids } },
    select: { chatId: true, lastReadAt: true },
  });
  const readAt = new Map(reads.map((r) => [r.chatId, r.lastReadAt]));
  for (const n of nodes) n.since = readAt.get(n.id) ?? n.since;

  const [unreadRows, lastRows] = await Promise.all([
    prisma.$queryRaw<{ chatId: string; n: number }[]>`
      SELECT m."chatId", COUNT(*)::int AS n
      FROM "ChatMessage" m
      JOIN unnest(${ids}::text[], ${nodes.map((n) => n.since.toISOString())}::text[]) AS s(id, since)
        ON s.id = m."chatId"
      WHERE m."createdAt" > (s.since::timestamptz AT TIME ZONE 'UTC')
        AND m."deletedAt" IS NULL
        AND m."authorId" IS DISTINCT FROM ${viewer.id}
      GROUP BY m."chatId"`,
    prisma.$queryRaw<
      { chatId: string; text: string | null; deletedAt: Date | null; createdAt: Date; authorName: string | null; media: ChatMediaKind | null }[]
    >`
      SELECT DISTINCT ON (m."chatId") m."chatId", m."text", m."deletedAt", m."createdAt",
        COALESCE(u."name", m."importedAuthorName") AS "authorName",
        (SELECT a."kind"::text FROM "ChatAttachment" a WHERE a."messageId" = m."id" ORDER BY a."position" LIMIT 1) AS "media"
      FROM "ChatMessage" m
      LEFT JOIN "User" u ON u."id" = m."authorId"
      WHERE m."chatId" = ANY(${ids}::text[])
      ORDER BY m."chatId", m."createdAt" DESC, m."id" DESC`,
  ]);
  const unread = new Map(unreadRows.map((r) => [r.chatId, r.n]));
  const last = new Map(lastRows.map((r) => [r.chatId, r]));

  const toItem = (n: ListNode): ChatListItemDTO => {
    const l = last.get(n.id);
    return {
      id: n.id,
      name: n.name,
      parentId: n.parentId,
      muted: n.muted,
      archived: n.archived,
      unread: unread.get(n.id) ?? 0,
      lastMessage: l
        ? {
            text: l.deletedAt ? null : l.text,
            authorName: l.authorName?.trim() ?? null,
            deleted: l.deletedAt !== null,
            createdAt: l.createdAt.toISOString(),
            media: l.deletedAt ? null : l.media,
          }
        : null,
      activityAt: n.lastMessageAt?.toISOString() ?? null,
      topics: [],
    };
  };

  const roots = nodes.filter((n) => n.parentId === null).map(toItem);
  const byId = new Map(roots.map((r) => [r.id, r]));
  const topicNodes = nodes
    .filter((n) => n.parentId !== null)
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
  for (const t of topicNodes) byId.get(t.parentId!)?.topics.push(toItem(t));

  // A chat's activity is its own or any of its topics' — newest first, then
  // never-used chats by creation.
  const created = new Map(nodes.map((n) => [n.id, n.createdAt.getTime()]));
  for (const r of roots) {
    for (const t of r.topics) if (t.activityAt && (!r.activityAt || t.activityAt > r.activityAt)) r.activityAt = t.activityAt;
  }
  roots.sort((a, b) =>
    a.activityAt && b.activityAt
      ? b.activityAt.localeCompare(a.activityAt)
      : a.activityAt
        ? -1
        : b.activityAt
          ? 1
          : created.get(b.id)! - created.get(a.id)!,
  );

  const live = roots.filter((r) => !r.archived);
  const unreadTotal = live.reduce(
    (sum, r) => sum + (r.muted ? 0 : r.unread + r.topics.reduce((s, t) => s + t.unread, 0)),
    0,
  );
  return { chats: live, archived: roots.filter((r) => r.archived), unreadTotal };
}

function pick(c: { id: string; name: string; lastMessageAt: Date | null; createdAt: Date; position: number }) {
  return { id: c.id, name: c.name, lastMessageAt: c.lastMessageAt, createdAt: c.createdAt, position: c.position };
}

// ── One chat ─────────────────────────────────────────────────────────────────

export async function getChatDetail(access: ChatAccess, viewer: ChatViewer): Promise<ChatDetailDTO> {
  const { chat, root, membership, archived } = access;
  const moderator = canModerateChat(viewer);
  const creator = canCreateChats(viewer);
  const seesPush = creator || moderator;

  const [topics, members] = await Promise.all([
    prisma.chat.findMany({
      where: { parentId: root.id, ...(moderator ? {} : { archivedAt: null }) },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, archivedAt: true },
    }),
    prisma.chatMember.findMany({
      where: { chatId: root.id },
      select: {
        user: {
          select: { id: true, name: true, image: true, status: true, _count: { select: { pushSubscriptions: true } } },
        },
      },
    }),
  ]);

  return {
    id: chat.id,
    name: chat.name,
    parent: chat.parent ? { id: chat.parent.id, name: chat.parent.name } : null,
    rootId: root.id,
    archived,
    muted: membership.mutedAt !== null,
    topics: topics.map((t) => ({ id: t.id, name: t.name, archived: t.archivedAt !== null })),
    members: members
      .map(({ user: u }) => ({
        userId: u.id,
        name: u.name.trim(),
        image: u.image,
        status: u.status,
        ...(seesPush ? { hasPush: u._count.pushSubscriptions > 0 } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    can: {
      addMembers: creator && !archived,
      removeMembers: moderator,
      createTopic: creator && !archived,
      rename: creator,
      archive: moderator,
      delete: moderator && archived,
      mentionAll: canMentionAll(viewer) && !archived,
      moderate: moderator,
    },
  };
}

/**
 * Mark a chat/topic read up to now. `viewing` also records (true) or clears
 * (false) the "looking at it right now" heartbeat that suppresses pushes;
 * omitted leaves it alone.
 */
export async function markRead(chatId: string, userId: string, viewing?: boolean): Promise<void> {
  const now = new Date();
  const viewingAt = viewing === undefined ? undefined : viewing ? now : null;
  await prisma.chatReadState.upsert({
    where: { chatId_userId: { chatId, userId } },
    create: { chatId, userId, lastReadAt: now, viewingAt: viewingAt ?? null },
    update: { lastReadAt: now, ...(viewingAt !== undefined ? { viewingAt } : {}) },
  });
}

// ── Admin ────────────────────────────────────────────────────────────────────

/** Everyone who can be put in a chat (Hub accounts, including invited-not-yet-joined; see CHAT_USERS). */
export async function listChatPeople(): Promise<ChatPersonDTO[]> {
  const users = await prisma.user.findMany({
    where: CHAT_USERS,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, image: true, status: true },
  });
  return users.map((u) => ({ ...u, name: u.name.trim() }));
}

/** Only real user ids that may be in a chat survive (silently drops the rest). */
async function existingUserIds(ids: string[]): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids)] }, ...CHAT_USERS },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function createChat(viewer: ChatViewer, { name, memberIds }: { name: string; memberIds: string[] }) {
  const userIds = await existingUserIds([...memberIds, viewer.id]);
  const chat = await prisma.chat.create({
    data: {
      name,
      createdById: viewer.id,
      members: { createMany: { data: userIds.map((userId) => ({ userId })) } },
    },
    select: { id: true },
  });
  return { id: chat.id, memberIds: userIds };
}

export async function createTopic(rootId: string, viewer: ChatViewer, name: string) {
  const last = await prisma.chat.findFirst({
    where: { parentId: rootId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return prisma.chat.create({
    data: { name, parentId: rootId, position: (last?.position ?? -1) + 1, createdById: viewer.id },
    select: { id: true },
  });
}

export async function addMembers(rootId: string, ids: string[]): Promise<string[]> {
  const userIds = await existingUserIds(ids);
  await prisma.chatMember.createMany({
    data: userIds.map((userId) => ({ chatId: rootId, userId })),
    skipDuplicates: true,
  });
  return userIds;
}

/**
 * Permanently delete a chat (with its topics) or a topic. Callers check it's
 * archived and the viewer moderates. The DB cascades take the messages,
 * attachments, reactions, mentions, members and read states; the media files
 * are removed from storage after.
 */
export async function deleteChat(chatId: string): Promise<void> {
  const files = await prisma.chatAttachment.findMany({
    where: { message: { chat: { OR: [{ id: chatId }, { parentId: chatId }] } } },
    select: { path: true, posterPath: true },
  });
  await prisma.chat.delete({ where: { id: chatId } });
  await deleteChatObjects(files.flatMap((f) => [f.path, f.posterPath ?? '']));
}

export async function removeMember(rootId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.chatMember.deleteMany({ where: { chatId: rootId, userId } });
  // Their read state for the chat and its topics goes with them.
  await prisma.chatReadState.deleteMany({
    where: { userId, chat: { OR: [{ id: rootId }, { parentId: rootId }] } },
  });
  return count > 0;
}
