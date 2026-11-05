import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  CHAT_SEARCH_PAGE_SIZE,
  type ChatSearchHitDTO,
  type ChatSearchMode,
  type ChatSearchPageDTO,
  type ChatSnippetPartDTO,
} from './types';
import type { ChatAccess, ChatViewer } from './server';

// Message search. Scope is either one chat — the chat and all its topics, so
// searching Worship finds what was said in # Attire too — or every chat the
// viewer is in. Either way the chat ids come from the viewer's memberships,
// so a search can never reach a chat they can't open.
//
// Matching: full-text first (the ChatMessage_text_search_idx GIN index —
// keep the to_tsvector expression below identical to it or the index goes
// unused), each word as a prefix so "rehears" finds "rehearsal". If that finds
// nothing, fall back to a plain substring match, which catches mid-word text,
// emoji and stop words ("the") that full-text drops.

const START = '\u0001';
const STOP = '\u0002';
const HEADLINE_OPTS = `StartSel=${START}, StopSel=${STOP}, MaxWords=24, MinWords=10, ShortWord=2, MaxFragments=2, FragmentDelimiter=" … "`;
/** Characters of context either side of a substring hit. */
const TEXT_CONTEXT = 60;

type Scope = { ids: string[]; names: Map<string, { name: string; parentName: string | null }> };

/** The chat + its live topics (plus the chat itself even if archived — a moderator has it open). */
async function chatScope(access: ChatAccess): Promise<Scope> {
  const { chat, root } = access;
  const topics = await prisma.chat.findMany({
    where: { parentId: root.id, archivedAt: null },
    select: { id: true, name: true },
  });
  const names: Scope['names'] = new Map([[root.id, { name: root.name, parentName: null }]]);
  for (const t of topics) names.set(t.id, { name: t.name, parentName: root.name });
  if (chat.parent && !names.has(chat.id)) names.set(chat.id, { name: chat.name, parentName: root.name });
  return { ids: [...names.keys()], names };
}

/** Every live chat + topic the viewer is in (archived ones are left out, as in the chat list). */
async function allScope(viewer: ChatViewer): Promise<Scope> {
  const memberships = await prisma.chatMember.findMany({
    where: { userId: viewer.id, chat: { parentId: null, archivedAt: null } },
    select: {
      chat: { select: { id: true, name: true, topics: { where: { archivedAt: null }, select: { id: true, name: true } } } },
    },
  });
  const names: Scope['names'] = new Map();
  for (const { chat } of memberships) {
    names.set(chat.id, { name: chat.name, parentName: null });
    for (const t of chat.topics) names.set(t.id, { name: t.name, parentName: chat.name });
  }
  return { ids: [...names.keys()], names };
}

/** "rehears tonight" → "rehears:* & tonight:*". Letters/digits only, so user input can't form tsquery syntax. Null = no words. */
export function toPrefixQuery(q: string): string | null {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.length ? [...new Set(words)].slice(0, 8).map((w) => `${w}:*`).join(' & ') : null;
}

type HitRow = {
  id: string;
  chatId: string;
  createdAt: Date;
  text: string;
  authorId: string | null;
  authorName: string | null;
  authorImage: string | null;
  importedAuthorName: string | null;
  importedAuthorAvatar: string | null;
  headline: string | null;
};

export async function searchMessages(
  viewer: ChatViewer,
  { q, access, before, mode }: { q: string; access: ChatAccess | null; before?: string; mode?: ChatSearchMode },
): Promise<ChatSearchPageDTO> {
  const scope = access ? await chatScope(access) : await allScope(viewer);
  const tsq = toPrefixQuery(q);
  const empty = (m: ChatSearchMode): ChatSearchPageDTO => ({ hits: [], hasMore: false, mode: m });
  if (scope.ids.length === 0) return empty(mode ?? 'words');

  // Words first; on a first page with no word hits, try the substring match.
  let useMode: ChatSearchMode = mode ?? (tsq ? 'words' : 'text');
  if (useMode === 'words' && !tsq) useMode = 'text';
  let rows = await runQuery(scope.ids, q, tsq, useMode, before);
  if (useMode === 'words' && rows.length === 0 && !before) {
    useMode = 'text';
    rows = await runQuery(scope.ids, q, tsq, useMode, before);
  }

  const hasMore = rows.length > CHAT_SEARCH_PAGE_SIZE;
  return {
    mode: useMode,
    hasMore,
    hits: rows.slice(0, CHAT_SEARCH_PAGE_SIZE).map((r) => {
      const where = scope.names.get(r.chatId) ?? { name: '', parentName: null };
      return {
        id: r.id,
        chatId: r.chatId,
        chatName: where.name,
        parentName: where.parentName,
        author: r.authorId && r.authorName ? { id: r.authorId, name: r.authorName.trim(), image: r.authorImage } : null,
        importedAuthorName: r.importedAuthorName,
        importedAuthorAvatar: r.importedAuthorAvatar,
        createdAt: r.createdAt.toISOString(),
        snippet: useMode === 'words' && r.headline ? fromHeadline(r.text, r.headline) : substringSnippet(r.text, q),
      };
    }),
  };
}

function runQuery(ids: string[], q: string, tsq: string | null, mode: ChatSearchMode, before?: string) {
  const match =
    mode === 'words'
      ? Prisma.sql`to_tsvector('english', coalesce(m."text", '')) @@ to_tsquery('english', ${tsq})`
      : Prisma.sql`m."text" ILIKE ${`%${escapeLike(q)}%`} ESCAPE '\\'`;
  // Newest first; `before` continues from the last hit shown.
  const cursor = before
    ? Prisma.sql`AND (m."createdAt", m."id") < (SELECT c."createdAt", c."id" FROM "ChatMessage" c WHERE c."id" = ${before})`
    : Prisma.empty;
  const headline =
    mode === 'words'
      ? Prisma.sql`ts_headline('english', h."text", to_tsquery('english', ${tsq}), ${HEADLINE_OPTS})`
      : Prisma.sql`NULL::text`;

  // Headlines are computed on the page only (they're the expensive part).
  return prisma.$queryRaw<HitRow[]>`
    SELECT h.*, ${headline} AS "headline"
    FROM (
      SELECT m."id", m."chatId", m."createdAt", m."text", m."authorId",
        u."name" AS "authorName", u."image" AS "authorImage",
        m."importedAuthorName", m."importedAuthorAvatar"
      FROM "ChatMessage" m
      LEFT JOIN "User" u ON u."id" = m."authorId"
      WHERE m."chatId" = ANY(${ids}::text[])
        AND m."deletedAt" IS NULL
        AND m."text" IS NOT NULL
        AND ${match}
        ${cursor}
      ORDER BY m."createdAt" DESC, m."id" DESC
      LIMIT ${CHAT_SEARCH_PAGE_SIZE + 1}
    ) h
    ORDER BY h."createdAt" DESC, h."id" DESC`;
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** ts_headline output → parts, with "…" where the fragment cuts the message. */
function fromHeadline(text: string, headline: string): ChatSnippetPartDTO[] {
  const parts: ChatSnippetPartDTO[] = [];
  for (const [i, chunk] of headline.split(START).entries()) {
    if (i === 0) {
      if (chunk) parts.push({ text: chunk });
      continue;
    }
    const [hit, rest = ''] = chunk.split(STOP);
    if (hit) parts.push({ text: hit, hit: true });
    if (rest) parts.push({ text: rest });
  }
  const plain = parts.map((p) => p.text).join('');
  const first = plain.split(' … ')[0];
  const last = plain.split(' … ').at(-1) ?? '';
  if (!text.startsWith(first)) parts.unshift({ text: '…' });
  if (!text.endsWith(last)) parts.push({ text: '…' });
  return parts;
}

/** Every case-insensitive occurrence of q highlighted, in a window around the first. */
function substringSnippet(text: string, q: string): ChatSnippetPartDTO[] {
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const at = lower.indexOf(needle);
  const from = at < 0 ? 0 : Math.max(0, at - TEXT_CONTEXT);
  const to = at < 0 ? Math.min(text.length, TEXT_CONTEXT * 2) : Math.min(text.length, at + needle.length + TEXT_CONTEXT * 2);
  const parts: ChatSnippetPartDTO[] = from > 0 ? [{ text: '…' }] : [];
  let i = from;
  while (needle && i < to) {
    const j = lower.indexOf(needle, i);
    if (j < 0 || j >= to) break;
    if (j > i) parts.push({ text: text.slice(i, j) });
    parts.push({ text: text.slice(j, j + needle.length), hit: true });
    i = j + needle.length;
  }
  if (i < to) parts.push({ text: text.slice(i, to) });
  if (to < text.length) parts.push({ text: '…' });
  return parts;
}
