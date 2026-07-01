/* GNW Hub — database restore.
 *
 * Re-inserts the rows from a backup JSON (produced by db-backup.mjs) into the
 * database. Tables are inserted in foreign-key-dependency order (computed from
 * Prisma.dmmf), and DateTime columns are revived from ISO strings back to Date.
 *
 * Usage:
 *   npm run db:restore                     # restores the newest backup in ./backups
 *   npm run db:restore -- <path-to.json>   # restores a specific file
 *
 * Safety:
 *  - Uses createMany({ skipDuplicates: true }) — existing rows (matched by unique
 *    keys) are left untouched, so this is a safe merge, not an overwrite. Restore
 *    into an EMPTY database for an exact 1:1 recovery.
 *  - This only INSERTS; it never deletes. It won't undo a reset by itself.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BACKUP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'backups');
const delegateOf = (name) => name.charAt(0).toLowerCase() + name.slice(1);

const prisma = new PrismaClient();

// Topologically sort models so a table is inserted after the tables it references
// via a foreign key. Self-references are ignored for ordering (nullable FKs).
function orderedModels() {
  const models = Prisma.dmmf.datamodel.models;
  const byName = new Map(models.map((m) => [m.name, m]));
  const deps = new Map(); // model -> set of models it depends on
  for (const m of models) {
    const set = new Set();
    for (const f of m.fields) {
      if (f.kind === 'object' && f.relationFromFields?.length && f.type !== m.name && byName.has(f.type)) {
        set.add(f.type);
      }
    }
    deps.set(m.name, set);
  }
  const ordered = [];
  const done = new Set();
  let guard = 0;
  while (ordered.length < models.length) {
    let progressed = false;
    for (const m of models) {
      if (done.has(m.name)) continue;
      if ([...deps.get(m.name)].every((d) => done.has(d))) {
        ordered.push(m);
        done.add(m.name);
        progressed = true;
      }
    }
    if (!progressed || guard++ > models.length + 1) {
      // Cycle (or unresolved dep) — append the rest as-is; skipDuplicates absorbs it.
      for (const m of models) if (!done.has(m.name)) ordered.push(m);
      break;
    }
  }
  return ordered;
}

function reviveDates(model, rows) {
  const dateFields = model.fields.filter((f) => f.type === 'DateTime').map((f) => f.name);
  if (!dateFields.length) return rows;
  return rows.map((row) => {
    const out = { ...row };
    for (const f of dateFields) if (out[f] != null) out[f] = new Date(out[f]);
    return out;
  });
}

async function main() {
  let file = process.argv[2];
  if (!file) {
    const backups = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('gnw-backup-') && f.endsWith('.json'))
      .map((f) => ({ f, t: statSync(join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!backups.length) throw new Error(`No backups found in ${BACKUP_DIR}`);
    file = join(BACKUP_DIR, backups[0].f);
  }

  const payload = JSON.parse(readFileSync(file, 'utf8'));
  const data = payload.data ?? {};
  console.log(`Restoring from: ${file}`);

  for (const model of orderedModels()) {
    const rows = data[model.name];
    if (!rows?.length) continue;
    const res = await prisma[delegateOf(model.name)].createMany({
      data: reviveDates(model, rows),
      skipDuplicates: true,
    });
    console.log(`  ${model.name}: ${res.count}/${rows.length} inserted`);
  }
  console.log('✔ Restore complete.');
}

main()
  .catch((e) => {
    console.error('Restore failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
