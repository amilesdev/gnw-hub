/* GNW Hub — import a GroupMe chat's history into Hub chat (chat Phase 4).
 *
 * Pages every message of one GroupMe chat (and its kept topics) through the
 * developer API, maps authors with the confirmed list in groupme/name-mapping.csv
 * (unmatched → "former member" under their GroupMe name), keeps the original
 * timestamps, replies, mentions, pins and reactions, and re-hosts photos/videos
 * in the private `gnw-chat` bucket (GroupMe's URLs die with GroupMe).
 *
 * Run (inside GNW-Hub/):
 *   npm run groupme:import -- "GNW Leaders" --dry-run      # counts + pre-cutover check, writes nothing
 *   npm run groupme:import -- "GNW Leaders"                # import (creates the Hub chat/topics if missing)
 *   npm run groupme:import -- "GNW Leaders" --add-members  # also add the chat's GroupMe people to the Hub chat
 *   npm run groupme:import -- "GNW Leaders" --into "Import Test"   # into a throwaway Hub chat instead
 * The name can be the Hub name or the GroupMe name (see CHATS below).
 *
 * Re-runnable: message ids are derived from the GroupMe id (`gm_<id>`) and
 * `importSource='groupme'` + `importId` is unique, so a re-run only adds what's
 * new (the final delta at cutover). Already-imported messages get their author,
 * text and new reactions refreshed — re-run after adding people to Hub and
 * confirming them in the CSV, and their old messages become theirs.
 *
 * Writes go straight to the DB: no pushes, no realtime pings. Open apps catch up
 * on their next resume. Run `npm run db:backup` first.
 *
 * Needs GROUPME_TOKEN (local only, never printed), DATABASE_URL, the Supabase
 * service key and SUPABASE_CHAT_BUCKET in .env.local.
 */
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const API = 'https://api.groupme.com/v3';
const DELAY_MS = 300; // the probe paged ~12k messages at this pace with no 429s
const CHUNK = 250; // new messages per DB transaction
const MEDIA_CONCURRENCY = 4;

/** GroupMe chat → Hub chat. Topics not listed here are retired and skipped. */
const CHATS = [
  { groupme: 'GNW Leadership', hub: 'GNW Leaders' },
  { groupme: 'Grace Nation Band', hub: 'GNW Band' },
  { groupme: 'GN Jr. Worship Team', hub: 'Junior Worship' },
  { groupme: 'GN New Jersey', hub: 'GNW New Jersey' },
  { groupme: 'GNW Social Media', hub: 'GNW Social Media', topics: { Links: 'Links', 'Ideas/Suggestions': 'Ideas/Suggestions' } },
  {
    groupme: 'Grace Nation Worship',
    hub: 'Worship',
    topics: {
      'Styling Attire': 'Attire',
      'Crossover 2026/27': 'Crossover',
      'Rated R for Righteous': 'Rated R for Righteous',
      'Encounter Nights': 'Encounter Nights',
    },
  },
];

const token = process.env.GROUPME_TOKEN?.trim();
const CHAT_BUCKET = process.env.SUPABASE_CHAT_BUCKET ?? 'gnw-chat';
const MEDIA_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'gnw-media';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const addMembers = args.includes('--add-members');
// --into "<name>": import into a differently named Hub chat (a throwaway test run).
const intoIdx = args.indexOf('--into');
const into = intoIdx >= 0 ? args[intoIdx + 1]?.trim() : null;
const wanted = args.find((a, i) => !a.startsWith('--') && (intoIdx < 0 || i !== intoIdx + 1))?.toLowerCase().trim();

const prisma = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Hub id for a GroupMe message. Zero-padded so imported ids sort in GroupMe order (the createdAt tie-break). */
const msgId = (gmId) => `gm_${String(gmId).padStart(20, '0')}`;
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const count = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);

// ── GroupMe API ──────────────────────────────────────────────────────────────

/** GET a GroupMe endpoint. Returns { status, body } — 304 means "no more messages". */
async function gm(path, { retries = 4 } = {}) {
  await sleep(DELAY_MS);
  const res = await fetch(`${API}${path}`, { headers: { 'X-Access-Token': token } });
  if (res.status === 429 && retries > 0) {
    const wait = 5000 * (5 - retries);
    console.log(`  rate-limited, waiting ${wait / 1000}s…`);
    await sleep(wait);
    return gm(path, { retries: retries - 1 });
  }
  if (res.status === 304) return { status: 304, body: null };
  let body = null;
  try {
    body = JSON.parse(await res.text())?.response ?? null;
  } catch {
    /* non-JSON error page */
  }
  return { status: res.status, body };
}

async function findGroup(name) {
  for (let page = 1; ; page++) {
    const { status, body } = await gm(`/groups?page=${page}&per_page=100&omit=memberships`);
    if (status !== 200 || !Array.isArray(body) || body.length === 0) return null;
    const hit = body.find((g) => g.name === name);
    if (hit) return hit;
    if (body.length < 100) return null;
  }
}

/** Every message in a GroupMe chat or topic, oldest → newest. */
async function fetchMessages(groupId, label) {
  const all = [];
  let beforeId = null;
  for (;;) {
    const { status, body } = await gm(`/groups/${groupId}/messages?limit=100${beforeId ? `&before_id=${beforeId}` : ''}`);
    if (status === 304) break;
    const msgs = body?.messages;
    if (status !== 200 || !Array.isArray(msgs)) throw new Error(`GroupMe returned HTTP ${status} paging ${label}`);
    if (msgs.length === 0) break;
    all.push(...msgs);
    beforeId = msgs[msgs.length - 1].id;
    process.stdout.write(`  ${label}: ${all.length} messages fetched\r`);
  }
  process.stdout.write('\n');
  return all.reverse();
}

// ── Name mapping ─────────────────────────────────────────────────────────────

/** Minimal CSV reader for groupme-names.mjs's output (quoted fields, "" escapes, no embedded newlines). */
function parseCsv(text) {
  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted && ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const [head, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const keys = parseLine(head);
  return lines.map((l) => Object.fromEntries(parseLine(l).map((v, i) => [keys[i], v])));
}

/** GroupMe user id → Hub user id, from confirmed_email only (blank / `former` = former member). */
async function loadMapping() {
  const rows = parseCsv(await readFile('groupme/name-mapping.csv', 'utf8'));
  const emailByGm = new Map(
    rows
      .map((r) => [r.groupme_user_id, r.confirmed_email?.trim().toLowerCase()])
      .filter(([, e]) => e && e !== 'former'),
  );
  const users = await prisma.user.findMany({
    where: { email: { in: [...new Set(emailByGm.values())] } },
    select: { id: true, email: true },
  });
  const idByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const map = new Map();
  for (const [gmId, email] of emailByGm) {
    const id = idByEmail.get(email);
    if (id) map.set(gmId, id);
    else console.warn(`Warning: confirmed_email ${email} isn't a Hub account — treated as a former member.`);
  }
  return map;
}

// ── Media ────────────────────────────────────────────────────────────────────

const TYPE_BY_EXT = { jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime' };
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov' };

/** GroupMe media URLs carry the size: …/540x960.original.mp4, i.groupme.com/1024x768.jpeg.<hash>. */
function urlInfo(url) {
  const last = url.split('?')[0].split('/').pop() ?? '';
  const dims = last.match(/^(\d+)x(\d+)\./);
  const ext = last.match(/\.(jpe?g|png|gif|webp|mp4|mov)(?:\.|$)/i)?.[1].toLowerCase();
  return { width: dims ? Number(dims[1]) : null, height: dims ? Number(dims[2]) : null, ext };
}

/** Download with a couple of retries. Null = gone (or keeps failing). */
async function download(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const header = res.headers.get('content-type')?.split(';')[0].trim();
        const type = /^(image|video)\//.test(header ?? '') ? header : TYPE_BY_EXT[urlInfo(url).ext ?? ''];
        return { buf: Buffer.from(await res.arrayBuffer()), type: type ?? 'application/octet-stream' };
      }
      if (res.status === 403 || res.status === 404) return null;
    } catch {
      /* network blip — retry */
    }
    await sleep(1000 * attempt);
  }
  return null;
}

/**
 * Upload with retries. Big videos from a home connection drop mid-request when
 * several go at once, so files over BIG_FILE_BYTES take turns (small ones still
 * run MEDIA_CONCURRENCY at a time).
 */
const BIG_FILE_BYTES = 6 * 1024 * 1024;
let bigUploadQueue = Promise.resolve();
async function upload(bucket, path, file) {
  if (file.buf.length <= BIG_FILE_BYTES) return uploadNow(bucket, path, file);
  const turn = bigUploadQueue.then(() => uploadNow(bucket, path, file));
  bigUploadQueue = turn.catch(() => {});
  return turn;
}

async function uploadNow(bucket, path, file) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file.buf, { contentType: file.type, upsert: true, cacheControl: '300' });
      if (!error) return;
      if (attempt >= 4) throw new Error(error.message);
    } catch (e) {
      if (attempt >= 4) throw new Error(`upload ${path}: ${e.message}`);
    }
    console.log(`  upload retry ${attempt} for ${path.split('/').pop()}…`);
    await sleep(3000 * attempt);
  }
}

/** Run fn over items, a few at a time. */
async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

// ── Message shaping ──────────────────────────────────────────────────────────

const MEDIA_URL = /https?:\/\/[a-z]\.groupme\.com\/\S+/g;

/** GroupMe text → Hub text, or null if nothing is left. */
function cleanText(m) {
  const types = new Set((m.attachments ?? []).map((a) => a.type));
  if (types.has('audio')) return '🎤 Voice note (not carried over from GroupMe)';
  let t = m.text ?? '';
  const emoji = m.attachments?.find((a) => a.type === 'emoji');
  if (emoji?.placeholder) t = t.split(emoji.placeholder).join('').replace(/ {2,}/g, ' ');
  // A video message's text is its own URL.
  if (types.has('image') || types.has('video')) t = t.replace(MEDIA_URL, '');
  t = t.trim();
  if (types.has('file')) t = [t, '📎 File (not carried over from GroupMe)'].filter(Boolean).join('\n');
  if (!t && emoji && !types.has('image') && !types.has('video')) t = '(GroupMe emoji)';
  return t || null;
}

function mediaOf(m) {
  return (m.attachments ?? []).filter((a) => (a.type === 'image' || a.type === 'video') && a.url);
}

/** GroupMe reactions → [{ gmUserId, emoji }]. Real emoji from `reactions`; ❤️ from `favorited_by` only when that's all there is. */
function reactionsOf(m) {
  if (Array.isArray(m.reactions) && m.reactions.length) {
    return m.reactions.flatMap((r) => (r.user_ids ?? []).map((u) => ({ gmUserId: String(u), emoji: r.type === 'unicode' && r.code ? r.code : '❤️' })));
  }
  return (m.favorited_by ?? []).map((u) => ({ gmUserId: String(u), emoji: '❤️' }));
}

// ── Hub side ─────────────────────────────────────────────────────────────────

async function findOrCreateChat(name, parentId, createdById) {
  const found = await prisma.chat.findMany({ where: { name, parentId, archivedAt: null }, select: { id: true } });
  if (found.length > 1) throw new Error(`More than one live Hub chat named "${name}" — rename or archive one first.`);
  if (found[0]) return { id: found[0].id, created: false };
  if (dryRun) return { id: null, created: true };
  const position = parentId
    ? ((await prisma.chat.findFirst({ where: { parentId }, orderBy: { position: 'desc' }, select: { position: true } }))?.position ?? -1) + 1
    : 0;
  const chat = await prisma.chat.create({ data: { name, parentId, position, createdById }, select: { id: true } });
  return { id: chat.id, created: true };
}

/** Same rule as lib/access.ts → canUseChat (read from the file so the two can't drift). */
async function chatAccessWhere() {
  const src = await readFile('lib/access.ts', 'utf8');
  if (/CHAT_OPEN_TO_MEMBERS\s*=\s*true/.test(src)) return {};
  return { OR: [{ role: 'leader' }, { isSuperAdmin: true }, { chatModerator: true }, { chatEarlyAccess: true }] };
}

/** Former members' GroupMe avatars → the public media bucket (like Hub profile pictures). Cached per run. */
const avatarCache = new Map();
async function rehostAvatar(gmUserId, url) {
  if (!url || dryRun) return null;
  if (avatarCache.has(gmUserId)) return avatarCache.get(gmUserId);
  let out = null;
  const file = await download(url);
  if (file?.type.startsWith('image/')) {
    const path = `avatars/groupme/${gmUserId}.${EXT_BY_TYPE[file.type] ?? 'jpg'}`;
    await upload(MEDIA_BUCKET, path, file);
    out = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  avatarCache.set(gmUserId, out);
  return out;
}

/** Import one GroupMe chat or topic into one Hub chat or topic. */
async function importScope({ gmGroupId, label, chatId, rootId, mapping }) {
  const s = {
    label,
    fetched: 0,
    skippedSystem: 0,
    skippedEmpty: 0,
    new: 0,
    existing: 0,
    updated: 0,
    media: 0,
    mediaMissing: 0,
    replies: 0,
    repliesUnresolved: 0,
    reactions: 0,
    mentions: 0,
    pins: 0,
    formerAuthors: new Map(),
    newest: null,
  };
  const all = await fetchMessages(gmGroupId, label);
  s.fetched = all.length;

  const kept = all.filter((m) => {
    if (m.system || m.sender_type !== 'user') return (s.skippedSystem++, false);
    if (!cleanText(m) && mediaOf(m).length === 0) return (s.skippedEmpty++, false);
    return true;
  });
  const keptIds = new Set(kept.map((m) => String(m.id)));

  // Each former member's newest GroupMe name + avatar.
  const formerLatest = new Map();
  for (const m of kept) if (!mapping.has(String(m.user_id))) formerLatest.set(String(m.user_id), m);

  const existingRows = chatId
    ? await prisma.chatMessage.findMany({
        where: { importSource: 'groupme', importId: { in: [...keptIds] } },
        select: { importId: true, chatId: true, authorId: true, importedAuthorName: true, importedAuthorAvatar: true, text: true, deletedAt: true },
      })
    : [];
  const existing = new Map(existingRows.map((r) => [r.importId, r]));
  const wrongChat = existingRows.find((r) => r.chatId !== chatId);
  if (wrongChat) throw new Error(`${label}: some messages were already imported into a different Hub chat — not importing twice.`);

  const newRows = [];
  const updates = [];
  const allMentions = [];
  const allReactions = [];

  for (const m of kept) {
    const gmId = String(m.id);
    const id = msgId(gmId);
    const authorGm = String(m.user_id);
    const authorId = mapping.get(authorGm) ?? null;
    const latest = formerLatest.get(authorGm);
    const importedAuthorName = authorId ? null : (latest?.name ?? m.name ?? 'Former member').trim();
    const importedAuthorAvatar = authorId ? null : await rehostAvatar(authorGm, latest?.avatar_url);
    if (!authorId) count(s.formerAuthors, importedAuthorName);
    const text = cleanText(m);
    const createdAt = new Date(m.created_at * 1000);
    if (!s.newest || createdAt > s.newest) s.newest = createdAt;

    for (const userId of new Set((m.attachments ?? []).filter((a) => a.type === 'mentions').flatMap((a) => (a.user_ids ?? []).map((u) => mapping.get(String(u)))).filter(Boolean))) {
      allMentions.push({ messageId: id, userId });
    }
    for (const r of reactionsOf(m)) {
      allReactions.push({ messageId: id, userId: mapping.get(r.gmUserId) ?? null, importedUserId: r.gmUserId, emoji: r.emoji });
    }

    const prior = existing.get(gmId);
    if (prior) {
      s.existing++;
      // Refresh what can change: the author (newly mapped people) and GroupMe edits. A message deleted in Hub stays deleted.
      const changed =
        prior.authorId !== authorId ||
        prior.importedAuthorName !== importedAuthorName ||
        (importedAuthorAvatar && prior.importedAuthorAvatar !== importedAuthorAvatar) ||
        (!prior.deletedAt && prior.text !== text);
      if (changed) {
        updates.push({
          id,
          data: {
            authorId,
            importedAuthorName,
            ...(importedAuthorAvatar || authorId ? { importedAuthorAvatar } : {}),
            ...(prior.deletedAt ? {} : { text }),
          },
        });
      }
      continue;
    }

    const reply = m.attachments?.find((a) => a.type === 'reply');
    const replyGm = reply?.reply_id ? String(reply.reply_id) : null;
    if (replyGm) keptIds.has(replyGm) ? s.replies++ : s.repliesUnresolved++;
    if (m.pinned_at) s.pins++;

    newRows.push({
      gm: m,
      row: {
        id,
        chatId,
        authorId,
        importedAuthorName,
        importedAuthorAvatar,
        text,
        replyToId: replyGm && keptIds.has(replyGm) ? msgId(replyGm) : null,
        pinnedAt: m.pinned_at ? new Date(m.pinned_at * 1000) : null,
        pinnedById: m.pinned_at ? (mapping.get(String(m.pinned_by)) ?? null) : null,
        importSource: 'groupme',
        importId: gmId,
        createdAt,
      },
    });
  }
  s.new = newRows.length;
  s.updated = updates.length;
  s.media = newRows.reduce((n, r) => n + mediaOf(r.gm).length, 0);
  const newIds = new Set(newRows.map((r) => r.row.id));
  s.reactions = allReactions.filter((r) => newIds.has(r.messageId)).length;
  s.mentions = allMentions.filter((r) => newIds.has(r.messageId)).length;
  if (dryRun) return s;

  // New messages, a chunk at a time: re-host the chunk's media, then write the
  // messages + their attachments/mentions/reactions in one transaction, so a
  // crash never leaves a message without its photos (a re-run picks the chunk up again).
  let done = 0;
  for (const chunk of chunks(newRows, CHUNK)) {
    const attachments = [];
    const jobs = chunk.flatMap(({ gm: m, row }) => mediaOf(m).map((a, position) => ({ m, row, a, position })));
    await pool(jobs, MEDIA_CONCURRENCY, async ({ row, a, position }) => {
      const file = await download(a.url);
      if (!file) return void s.mediaMissing++;
      const kind = file.type.startsWith('video/') ? 'video' : 'image';
      const path = `chat/${rootId}/groupme/${row.importId}-${position}.${EXT_BY_TYPE[file.type] ?? urlInfo(a.url).ext ?? (kind === 'video' ? 'mp4' : 'jpg')}`;
      await upload(CHAT_BUCKET, path, file);
      let posterPath = null;
      if (kind === 'video' && a.preview_url) {
        const poster = await download(a.preview_url);
        if (poster?.type.startsWith('image/')) {
          posterPath = `chat/${rootId}/groupme/${row.importId}-${position}-poster.${EXT_BY_TYPE[poster.type] ?? 'jpg'}`;
          await upload(CHAT_BUCKET, posterPath, poster);
        }
      }
      const { width, height } = urlInfo(a.url);
      attachments.push({ messageId: row.id, kind, path, posterPath, width, height, sizeBytes: file.buf.length, position, createdAt: row.createdAt });
    });
    for (const { gm: m, row } of chunk) {
      if (!row.text && mediaOf(m).length && !attachments.some((a) => a.messageId === row.id)) row.text = '📷 Photo or video no longer available on GroupMe';
    }
    const ids = new Set(chunk.map((r) => r.row.id));
    await prisma.$transaction([
      prisma.chatMessage.createMany({ data: chunk.map((r) => r.row) }),
      prisma.chatAttachment.createMany({ data: attachments }),
      prisma.chatMention.createMany({ data: allMentions.filter((x) => ids.has(x.messageId)), skipDuplicates: true }),
      prisma.chatReaction.createMany({ data: allReactions.filter((x) => ids.has(x.messageId)), skipDuplicates: true }),
    ]);
    done += chunk.length;
    process.stdout.write(`  ${label}: ${done}/${newRows.length} new messages written\r`);
  }
  if (newRows.length) process.stdout.write('\n');

  // Already-imported messages: refreshed authors/text, plus any mentions/reactions added on GroupMe since.
  for (const u of updates) await prisma.chatMessage.update({ where: { id: u.id }, data: u.data });
  const oldIds = new Set([...existing.keys()].map(msgId));
  for (const c of chunks(allMentions.filter((x) => oldIds.has(x.messageId)), 1000)) await prisma.chatMention.createMany({ data: c, skipDuplicates: true });
  for (const c of chunks(allReactions.filter((x) => oldIds.has(x.messageId)), 1000)) await prisma.chatReaction.createMany({ data: c, skipDuplicates: true });

  if (s.newest) {
    await prisma.chat.updateMany({
      where: { id: chatId, OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: s.newest } }] },
      data: { lastMessageAt: s.newest },
    });
  }
  return s;
}

/** Reactions imported before their person was mapped: attach them to the Hub user now. */
async function remapReactions(mapping) {
  let n = 0;
  for (const [gmUserId, userId] of mapping) {
    try {
      n += (await prisma.chatReaction.updateMany({ where: { importedUserId: gmUserId, userId: null }, data: { userId } })).count;
    } catch {
      /* they also reacted the same way in Hub — leave the imported copy */
    }
  }
  return n;
}

function printScope(s) {
  console.log(`\n  ${s.label}`);
  console.log(`    ${s.fetched} fetched → ${s.new} new, ${s.existing} already imported${s.updated ? ` (${s.updated} refreshed)` : ''}; skipped ${s.skippedSystem} system + ${s.skippedEmpty} empty`);
  console.log(`    new: ${s.media} photos/videos${s.mediaMissing ? ` (${s.mediaMissing} no longer on GroupMe)` : ''}, ${s.replies} replies${s.repliesUnresolved ? ` (+${s.repliesUnresolved} to skipped messages, shown as plain)` : ''}, ${s.reactions} reactions, ${s.mentions} mentions, ${s.pins} pins`);
  if (s.formerAuthors.size) {
    console.log(`    former members: ${[...s.formerAuthors].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${c})`).join(', ')}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const found = CHATS.find((c) => c.hub.toLowerCase() === wanted || c.groupme.toLowerCase() === wanted);
  const target = found && into ? { ...found, hub: into } : found;
  if (!target) {
    console.error(`Which chat? npm run groupme:import -- "<name>" [--dry-run] [--add-members]\n  ${CHATS.map((c) => `${c.hub}  (GroupMe: ${c.groupme})`).join('\n  ')}`);
    process.exitCode = 1;
    return;
  }
  if (!token) {
    console.error('GROUPME_TOKEN is missing from .env.local.');
    process.exitCode = 1;
    return;
  }

  console.log(`${dryRun ? 'DRY RUN — nothing is written. ' : ''}GroupMe "${target.groupme}" → Hub "${target.hub}"`);
  const group = await findGroup(target.groupme);
  if (!group) throw new Error(`GroupMe chat "${target.groupme}" not found among your active groups.`);
  const mapping = await loadMapping();
  const superAdmin = await prisma.user.findFirst({ where: { isSuperAdmin: true }, select: { id: true } });

  const root = await findOrCreateChat(target.hub, null, superAdmin?.id ?? null);
  console.log(root.created ? `Hub chat "${target.hub}" ${dryRun ? 'will be created' : 'created'}.` : `Hub chat "${target.hub}" found.`);

  const scopes = [{ gmGroupId: group.id, label: target.hub, chatId: root.id }];
  const { body: topics } = await gm(`/groups/${group.id}/subgroups?page=1&per_page=100`);
  for (const t of Array.isArray(topics) ? topics : []) {
    const hubName = target.topics?.[t.topic];
    if (!hubName) {
      console.log(`Skipping retired topic "${t.topic}".`);
      continue;
    }
    const topic = root.id ? await findOrCreateChat(hubName, root.id, superAdmin?.id ?? null) : { id: null, created: true };
    if (topic.created) console.log(`Topic "${hubName}" ${dryRun ? 'will be created' : 'created'}.`);
    scopes.push({ gmGroupId: t.id, label: `${target.hub} › ${hubName}`, chatId: topic.id });
  }

  const results = [];
  for (const scope of scopes) results.push(await importScope({ ...scope, rootId: root.id, mapping }));
  results.forEach(printScope);
  if (!dryRun) {
    const remapped = await remapReactions(mapping);
    if (remapped) console.log(`\n  ${remapped} earlier imported reactions now belong to their Hub member.`);
  }

  // Pre-cutover check: everyone in the GroupMe chat today → are they set up in Hub?
  const { body: detail } = await gm(`/groups/${group.id}`);
  const gmMembers = detail?.members ?? [];
  const hubIds = [...new Set(gmMembers.map((m) => mapping.get(String(m.user_id))).filter(Boolean))];
  const access = await chatAccessWhere();
  const [users, inChat] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: hubIds } },
      select: { id: true, name: true, _count: { select: { pushSubscriptions: true } } },
    }),
    root.id ? prisma.chatMember.findMany({ where: { chatId: root.id }, select: { userId: true } }) : [],
  ]);
  const canUse = new Set((await prisma.user.findMany({ where: { id: { in: hubIds }, ...access }, select: { id: true } })).map((u) => u.id));
  const memberSet = new Set(inChat.map((m) => m.userId));

  if (addMembers && !dryRun) {
    const toAdd = users.filter((u) => canUse.has(u.id) && !memberSet.has(u.id));
    await prisma.chatMember.createMany({ data: toAdd.map((u) => ({ chatId: root.id, userId: u.id })), skipDuplicates: true });
    toAdd.forEach((u) => memberSet.add(u.id));
    if (toAdd.length) console.log(`\nAdded to "${target.hub}": ${toAdd.map((u) => u.name.trim()).join(', ')}`);
  }

  console.log(`\nPre-cutover check — the ${gmMembers.length} people in the GroupMe chat today:`);
  for (const m of gmMembers) {
    const u = users.find((x) => x.id === mapping.get(String(m.user_id)));
    if (!u) {
      console.log(`  ✗ ${m.nickname} — no Hub account mapped (add them to Hub, then confirm in name-mapping.csv)`);
      continue;
    }
    const gaps = [
      !canUse.has(u.id) && 'no chat access yet (soft launch)',
      !memberSet.has(u.id) && 'not in the Hub chat',
      u._count.pushSubscriptions === 0 && 'push not enabled on any device',
    ].filter(Boolean);
    console.log(`  ${gaps.length ? '•' : '✓'} ${u.name.trim()}${gaps.length ? ` — ${gaps.join('; ')}` : ''}`);
  }
}

main()
  .catch((e) => {
    console.error(`\n${e.message ?? e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
