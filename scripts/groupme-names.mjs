/* GNW Hub — build the GroupMe → Hub member name-mapping list (chat Phase 0).
 *
 * GroupMe has no emails, so the importer matches message authors to Hub members
 * by a list the user confirms once. This script drafts that list: every distinct
 * GroupMe author (from `npm run groupme:probe -- --scan`) with a suggested Hub
 * member. It only READS the database.
 *
 * Run (inside GNW-Hub/), after the probe scan:
 *   npm run groupme:names
 *
 * Output: groupme/name-mapping.csv (git-ignored). Fill the `confirmed_email`
 * column: a Hub member's email, or `former` → "former member" (shown under
 * their GroupMe name, grayed out). Blank = not decided yet (the importer treats
 * it as former, but re-runs keep suggesting). `note` is free text for humans.
 * The Phase 4 importer reads only `confirmed_email`.
 *
 * Re-running is safe: any `confirmed_email` / `note` already in the CSV is kept,
 * so run it again after new teams join Hub to pick up their matches.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OUT_DIR = 'groupme';

// "Judy(Judcine) Felix" → "judy felix", "Alonzo Miles, Jr." → "alonzo miles".
const norm = (s) =>
  (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const csv = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Minimal CSV reader for our own output (quoted fields, "" escapes, no embedded newlines). */
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

/** confirmed_email + note already in the CSV, by GroupMe user id — kept across re-runs. */
async function readPrior() {
  try {
    const rows = parseCsv(await readFile(`${OUT_DIR}/name-mapping.csv`, 'utf8'));
    return new Map(rows.map((r) => [r.groupme_user_id, { confirmed: r.confirmed_email?.trim() ?? '', note: r.note ?? '' }]));
  } catch {
    return new Map();
  }
}

/** Best Hub match for a set of GroupMe names → { user, confidence } or null. */
function suggest(names, users) {
  const candidates = names.map(norm).filter(Boolean);
  for (const n of candidates) {
    const exact = users.filter((u) => norm(u.name) === n);
    if (exact.length === 1) return { user: exact[0], confidence: 'high (exact name)' };
  }
  for (const n of candidates) {
    const [first, ...rest] = n.split(' ');
    const last = rest.at(-1);
    if (!last) continue;
    const hits = users.filter((u) => {
      const parts = norm(u.name).split(' ');
      return parts[0] === first && parts.at(-1)?.[0] === last[0];
    });
    if (hits.length === 1) return { user: hits[0], confidence: 'medium (first name + last initial)' };
  }
  for (const n of candidates) {
    const first = n.split(' ')[0];
    const hits = users.filter((u) => norm(u.name).split(' ')[0] === first);
    if (hits.length === 1) return { user: hits[0], confidence: 'low (first name only)' };
  }
  return null;
}

async function main() {
  let report;
  try {
    report = JSON.parse(await readFile(`${OUT_DIR}/probe.json`, 'utf8'));
  } catch {
    console.error('No groupme/probe.json yet. Run `npm run groupme:probe -- --scan` first.');
    process.exitCode = 1;
    return;
  }

  // One row per GroupMe user id, merged across every chat and topic.
  const people = new Map();
  const add = (chatName, userId, names, count, lastAt, isMember) => {
    const p = people.get(userId) ?? { userId, names: new Map(), chats: new Map(), total: 0, lastAt: null, currentMember: false };
    for (const [n, c] of Object.entries(names)) p.names.set(n, (p.names.get(n) ?? 0) + c);
    if (count) p.chats.set(chatName, (p.chats.get(chatName) ?? 0) + count);
    p.total += count;
    if (lastAt && (!p.lastAt || lastAt > p.lastAt)) p.lastAt = lastAt;
    p.currentMember ||= isMember;
    people.set(userId, p);
  };

  let scanned = 0;
  for (const chat of report.chats) {
    for (const m of chat.members ?? []) add(chat.name, m.userId, { [m.nickname]: 0, ...(m.name ? { [m.name]: 0 } : {}) }, 0, null, true);
    for (const scope of [chat, ...(chat.topics ?? [])]) {
      if (!scope.scan) continue;
      scanned++;
      const label = scope === chat ? chat.name : `${chat.name} › ${scope.name}`;
      for (const a of scope.scan.authors) add(label, a.userId, a.names, a.count, a.lastAt, false);
    }
  }
  if (!scanned) console.log('Note: probe.json has no --scan data, so this list only covers current GroupMe members.\n');

  const users = await prisma.user.findMany({ select: { name: true, email: true, status: true }, orderBy: { name: 'asc' } });
  const prior = await readPrior();
  const emails = new Set(users.map((u) => u.email));

  const rows = [...people.values()]
    .filter((p) => p.total > 0 || p.currentMember)
    .sort((a, b) => b.total - a.total)
    .map((p) => {
      const names = [...p.names.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n);
      const s = suggest(names, users);
      const kept = prior.get(p.userId);
      if (kept?.confirmed && kept.confirmed !== 'former' && !emails.has(kept.confirmed)) {
        console.warn(`Warning: confirmed_email ${kept.confirmed} (${names[0]}) isn't a Hub account.`);
      }
      return {
        groupme_user_id: p.userId,
        groupme_names: names.join(' / '),
        messages: p.total,
        chats: [...p.chats.entries()].map(([c, n]) => `${c} (${n})`).join('; '),
        last_message: p.lastAt?.slice(0, 10) ?? '',
        still_in_groupme: p.currentMember ? 'yes' : 'no',
        suggested_hub_name: s?.user.name ?? '',
        suggested_hub_email: s?.user.email ?? '',
        confidence: s?.confidence ?? 'none',
        confirmed_email: kept?.confirmed || (s?.confidence.startsWith('high') ? s.user.email : ''),
        note: kept?.note ?? '',
      };
    });

  const header = Object.keys(rows[0] ?? { groupme_user_id: '' });
  await writeFile(`${OUT_DIR}/name-mapping.csv`, [header.join(','), ...rows.map((r) => header.map((h) => csv(r[h])).join(','))].join('\n') + '\n');

  const by = (c) => rows.filter((r) => r.confidence.startsWith(c)).length;
  const confirmed = rows.filter((r) => r.confirmed_email && r.confirmed_email !== 'former').length;
  const former = rows.filter((r) => r.confirmed_email === 'former').length;
  console.log(`${rows.length} GroupMe people → ${by('high')} high, ${by('medium')} medium, ${by('low')} low, ${by('none')} unmatched.`);
  console.log(`confirmed_email: ${confirmed} mapped to Hub, ${former} former, ${rows.length - confirmed - former} undecided.`);
  console.log(`Wrote ${OUT_DIR}/name-mapping.csv — high matches are pre-filled in confirmed_email; check the rest.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
