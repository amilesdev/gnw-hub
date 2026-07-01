/* GNW Hub — database backup.
 *
 * Dumps every table to a single timestamped JSON file under ./backups. Driven by
 * Prisma's own model metadata (Prisma.dmmf), so any table you add later is picked
 * up automatically — no edits needed here.
 *
 * Run: npm run db:backup   (loads DIRECT_URL/DATABASE_URL via dotenv -e .env.local)
 *
 * Notes:
 *  - findMany() returns scalar columns only (no nested relations), so each row is
 *    exactly the table's columns — safe to restore with db-restore.mjs.
 *  - Keeps the most recent KEEP backups and prunes older ones.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KEEP = Number(process.env.BACKUP_KEEP ?? 30);
const BACKUP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'backups');

// camelCase the model name to its Prisma Client delegate (User -> user, GameSession -> gameSession).
const delegateOf = (name) => name.charAt(0).toLowerCase() + name.slice(1);

const prisma = new PrismaClient();

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });

  const models = Prisma.dmmf.datamodel.models;
  const data = {};
  const counts = {};

  for (const model of models) {
    const rows = await prisma[delegateOf(model.name)].findMany();
    data[model.name] = rows;
    counts[model.name] = rows.length;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(BACKUP_DIR, `gnw-backup-${stamp}.json`);
  const payload = {
    _meta: { app: 'gnw-hub', createdAt: new Date().toISOString(), counts },
    data,
  };
  // JSON.stringify serializes Date -> ISO string and Json columns as-is.
  writeFileSync(file, JSON.stringify(payload, null, 2));

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`✔ Backup written: ${file}`);
  console.log(`  ${total} rows across ${models.length} tables`);
  for (const [name, c] of Object.entries(counts)) if (c) console.log(`    ${name}: ${c}`);

  // Prune old backups, keeping the newest KEEP.
  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('gnw-backup-') && f.endsWith('.json'))
    .map((f) => ({ f, t: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of backups.slice(KEEP)) {
    unlinkSync(join(BACKUP_DIR, f));
    console.log(`  pruned old backup: ${f}`);
  }
}

main()
  .catch((e) => {
    console.error('Backup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
