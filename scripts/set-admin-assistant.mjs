/* GNW Hub — grant or revoke the administrative-assistant capability.
 *
 * The administrative assistant may import, re-import, and remove a song's lyric
 * chart (the Google Doc import), from the song card. Nothing else: no events,
 * no setlists, no song titles/keys/BPM, no vocal parts, no band arrangements,
 * no retiring songs. See lib/access.ts → canEditLyricCharts.
 *
 * This is deliberately a backend-only switch — there is no toggle in the app.
 *
 * Run (inside GNW-Hub/):
 *   npm run set-admin-assistant -- <email>            # grant
 *   npm run set-admin-assistant -- <email> --revoke   # revoke
 *   npm run set-admin-assistant -- --list             # who currently holds it
 *
 * Takes effect immediately — the NextAuth session callback re-reads the user on
 * every request, so there's no need for them to sign out and back in.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const list = args.includes('--list');
  const email = args.find((a) => !a.startsWith('--'))?.toLowerCase().trim();

  if (list) {
    const holders = await prisma.user.findMany({
      where: { adminAssistant: true },
      select: { name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    if (!holders.length) {
      console.log('No one currently has the administrative-assistant capability.');
    } else {
      console.log('Administrative assistant:');
      for (const h of holders) console.log(`  • ${h.name} <${h.email}>${h.role === 'leader' ? ' (leader)' : ''}`);
    }
    return;
  }

  if (!email) {
    console.error('Usage: npm run set-admin-assistant -- <email> [--revoke]');
    console.error('       npm run set-admin-assistant -- --list');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, status: true, adminAssistant: true },
  });

  if (!user) {
    console.error(`No user with email ${email}. (Members are created from the leader Members page.)`);
    process.exitCode = 1;
    return;
  }

  if (user.adminAssistant === !revoke) {
    console.log(`${user.name} <${user.email}> already ${revoke ? 'does not have' : 'has'} the administrative-assistant capability. Nothing to do.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { adminAssistant: !revoke } });

  console.log(`${revoke ? 'Revoked' : 'Granted'}: ${user.name} <${user.email}> ${revoke ? 'can no longer' : 'can now'} add lyric charts.`);
  if (user.status !== 'active') {
    console.log(`Note: this account is "${user.status}" — the capability applies once they claim their invite and sign in.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
