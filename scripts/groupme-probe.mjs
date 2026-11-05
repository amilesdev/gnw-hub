/* GNW Hub — GroupMe API probe (chat Phase 0 spike). READ-ONLY.
 *
 * Answers the open questions in Docs/Chat-Feature.md before we write the real
 * importer: which groups we can see, how topics come through the API, how many
 * messages each chat really returns (and how far back), what message shapes
 * look like (attachments, replies, likes, system messages), and whether old
 * GroupMe media URLs still resolve.
 *
 * Run (inside GNW-Hub/):
 *   npm run groupme:probe              # list groups + topics with message counts (fast)
 *   npm run groupme:probe -- --scan    # also page through EVERY message (slow, read-only)
 *   npm run groupme:probe -- --scan --only "GNW Leadership,Grace Nation Band"   # scan just these (name contains)
 *
 * Needs GROUPME_TOKEN in .env.local (local only — never commit it, never put it
 * in Vercel). The token goes in a header, never a URL, and is never printed.
 *
 * Output: groupme/probe.json (git-ignored — it holds real names and message
 * samples). `npm run groupme:names` builds the name-mapping list from it.
 */
import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://api.groupme.com/v3';
const OUT_DIR = 'groupme';
const DELAY_MS = 300; // go slow — GroupMe doesn't publish its rate limits
const SAMPLES_PER_KIND = 3;
const MEDIA_CHECKS = 6; // per chat: half from the oldest media, half from the newest

const token = process.env.GROUPME_TOKEN?.trim();
const args = process.argv.slice(2);
const scan = args.includes('--scan');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1]?.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);

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
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text)?.response ?? null;
  } catch {
    /* non-JSON error page */
  }
  return { status: res.status, body };
}

async function listGroups(path) {
  const groups = [];
  for (let page = 1; ; page++) {
    const { status, body } = await gm(`${path}?page=${page}&per_page=100&omit=memberships`);
    if (status !== 200 || !Array.isArray(body) || body.length === 0) break;
    groups.push(...body);
    if (path.endsWith('former') || body.length < 100) break;
  }
  return groups;
}

/** Topics are unverified — try the subgroups endpoint and record exactly what it returns. */
async function probeTopics(groupId) {
  const { status, body } = await gm(`/groups/${groupId}/subgroups?page=1&per_page=100`);
  return { status, topics: Array.isArray(body) ? body : null, keys: body && !Array.isArray(body) ? Object.keys(body) : null };
}

function summarizeGroup(g) {
  return {
    id: g.id,
    groupId: g.group_id,
    name: g.name ?? g.topic, // topics carry their name in `topic`
    type: g.type,
    parentId: g.parent_id ?? null,
    createdAt: iso(g.created_at),
    messageCount: g.messages?.count ?? null,
    lastMessageAt: iso(g.messages?.last_message_created_at),
    memberCount: g.members_count ?? g.members?.length ?? null,
    rawKeys: Object.keys(g).sort(),
  };
}

/** Page newest → oldest through a chat's messages, collecting stats (no writes anywhere). */
async function scanMessages(groupId, label) {
  const stats = {
    fetched: 0,
    oldestAt: null,
    newestAt: null,
    senderTypes: {},
    systemMessages: 0,
    attachmentTypes: {},
    replies: 0,
    likedMessages: 0,
    totalLikes: 0,
    emptyText: 0,
    stoppedBecause: null,
  };
  const authors = new Map(); // user_id → { names: Map(name → count), count, avatar, firstAt, lastAt, senderType }
  const samples = {}; // kind → raw messages
  const media = []; // { url, at, kind }

  const keep = (kind, m) => {
    samples[kind] ??= [];
    if (samples[kind].length < SAMPLES_PER_KIND) samples[kind].push(m);
  };

  let beforeId = null;
  for (;;) {
    const q = `limit=100${beforeId ? `&before_id=${beforeId}` : ''}`;
    const { status, body } = await gm(`/groups/${groupId}/messages?${q}`);
    if (status === 304) {
      stats.stoppedBecause = '304 (no older messages)';
      break;
    }
    const msgs = body?.messages;
    if (status !== 200 || !Array.isArray(msgs)) {
      stats.stoppedBecause = `HTTP ${status}`;
      break;
    }
    if (msgs.length === 0) {
      stats.stoppedBecause = 'empty page';
      break;
    }

    for (const m of msgs) {
      stats.fetched++;
      stats.newestAt ??= iso(m.created_at);
      stats.oldestAt = iso(m.created_at);
      stats.senderTypes[m.sender_type] = (stats.senderTypes[m.sender_type] ?? 0) + 1;
      if (m.system) {
        stats.systemMessages++;
        keep('system', m);
      }
      if (!m.text) stats.emptyText++;
      const likes = m.favorited_by?.length ?? 0;
      if (likes) {
        stats.likedMessages++;
        stats.totalLikes += likes;
        keep('liked', m);
      }
      for (const a of m.attachments ?? []) {
        stats.attachmentTypes[a.type] = (stats.attachmentTypes[a.type] ?? 0) + 1;
        keep(`attachment:${a.type}`, m);
        if (a.type === 'reply') stats.replies++;
        if ((a.type === 'image' || a.type === 'video' || a.type === 'linked_image') && a.url) {
          media.push({ url: a.url, at: m.created_at, kind: a.type });
        }
      }
      if (!m.system && !(m.attachments?.length)) keep('plain', m);

      if (m.sender_type === 'user' && m.user_id) {
        const a = authors.get(m.user_id) ?? {
          names: new Map(),
          count: 0,
          avatar: m.avatar_url ?? null,
          firstAt: m.created_at,
          lastAt: m.created_at,
        };
        a.count++;
        a.names.set(m.name, (a.names.get(m.name) ?? 0) + 1);
        a.firstAt = Math.min(a.firstAt, m.created_at);
        a.lastAt = Math.max(a.lastAt, m.created_at);
        authors.set(m.user_id, a);
      }
    }
    beforeId = msgs[msgs.length - 1].id;
    if (stats.fetched % 1000 < 100) process.stdout.write(`  ${label}: ${stats.fetched} messages (back to ${stats.oldestAt?.slice(0, 10)})\r`);
  }
  process.stdout.write('\n');

  // Do old GroupMe media URLs still resolve? Check a few of the oldest and newest.
  media.sort((x, y) => x.at - y.at);
  const half = Math.ceil(MEDIA_CHECKS / 2);
  const toCheck = media.length <= MEDIA_CHECKS ? media : [...media.slice(0, half), ...media.slice(-half)];
  const mediaChecks = [];
  for (const item of toCheck) {
    let status;
    try {
      // GroupMe's media CDN answers HEAD with 405, so ask for the first KB instead (206 = alive).
      const res = await fetch(item.url, { headers: { Range: 'bytes=0-1023' } });
      status = res.status;
    } catch (e) {
      status = `error: ${e.message}`;
    }
    mediaChecks.push({ kind: item.kind, at: iso(item.at), status });
    await sleep(100);
  }

  return {
    stats: { ...stats, mediaItems: media.length },
    authors: [...authors.entries()].map(([userId, a]) => ({
      userId,
      names: Object.fromEntries([...a.names.entries()].sort((x, y) => y[1] - x[1])),
      count: a.count,
      avatar: a.avatar,
      firstAt: iso(a.firstAt),
      lastAt: iso(a.lastAt),
    })),
    samples,
    mediaChecks,
  };
}

async function main() {
  if (!token) {
    console.error('GROUPME_TOKEN is missing from .env.local. Get one at dev.groupme.com (Access Token, top right).');
    process.exitCode = 1;
    return;
  }

  const me = await gm('/users/me');
  if (me.status !== 200) {
    console.error(`GroupMe rejected the token (HTTP ${me.status}). Re-copy it from dev.groupme.com.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Signed in to GroupMe as ${me.body?.name}.\n`);

  const active = await listGroups('/groups');
  const former = await listGroups('/groups/former');
  console.log(`Groups: ${active.length} active, ${former.length} former.\n`);

  const report = { generatedAt: new Date().toISOString(), me: { id: me.body?.id, name: me.body?.name }, chats: [] };

  for (const [list, groups] of [['active', active], ['former', former]]) {
    for (const g of groups) {
      const summary = { list, ...summarizeGroup(g) };
      const topicProbe = await probeTopics(g.id);
      summary.topicsEndpoint = { status: topicProbe.status, keysIfObject: topicProbe.keys };
      summary.topics = (topicProbe.topics ?? []).map(summarizeGroup);

      // Full group detail carries the current member list (nicknames + GroupMe user ids).
      const detail = await gm(`/groups/${g.id}`);
      summary.members = (detail.body?.members ?? []).map((m) => ({
        userId: m.user_id,
        nickname: m.nickname,
        name: m.name ?? null,
        image: m.image_url ?? null,
        roles: m.roles ?? null,
      }));

      console.log(`• ${summary.name}  [${list}]  ${summary.messageCount ?? '?'} msgs, ${summary.members.length} members, since ${summary.createdAt?.slice(0, 10)}`);
      console.log(`    topics endpoint: HTTP ${topicProbe.status}${summary.topics.length ? ` → ${summary.topics.length} topic(s)` : ''}`);
      for (const t of summary.topics) console.log(`    └ ${t.name}  ${t.messageCount ?? '?'} msgs  (id ${t.id})`);

      const wanted = !only || only.some((o) => summary.name?.toLowerCase().includes(o));
      if (scan && wanted) {
        summary.scan = await scanMessages(g.id, summary.name);
        console.log(`    scanned ${summary.scan.stats.fetched} msgs, ${summary.scan.stats.oldestAt?.slice(0, 10)} → ${summary.scan.stats.newestAt?.slice(0, 10)}, stopped: ${summary.scan.stats.stoppedBecause}`);
        for (const t of summary.topics) {
          t.scan = await scanMessages(t.id, `${summary.name} › ${t.name}`);
          console.log(`    └ ${t.name}: scanned ${t.scan.stats.fetched} msgs, stopped: ${t.scan.stats.stoppedBecause}`);
        }
      }
      report.chats.push(summary);
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}/probe.json`, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${OUT_DIR}/probe.json${scan ? '' : ' (run with --scan for full message stats + authors)'}.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
