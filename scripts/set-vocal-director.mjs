/* GNW Hub — grant or revoke the vocal-director capability.
 *
 * The vocal director may add, replace, and remove the four vocal-part audio
 * files on a song, from the song card. Nothing else: no events, no setlists, no
 * song titles/keys/BPM, no band arrangements, no retiring songs. See
 * lib/access.ts → canEditVocalParts.
 *
 * This is deliberately a backend-only switch — there is no toggle in the app.
 *
 * Run (inside GNW-Hub/):
 *   npm run set-vocal-director -- <email>            # grant
 *   npm run set-vocal-director -- <email> --revoke   # revoke
 *   npm run set-vocal-director -- --list             # who currently holds it
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
      where: { vocalDirector: true },
      select: { name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    if (!holders.length) {
      console.log('No one currently has the vocal-director capability.');
    } else {
      console.log('Vocal director:');
      for (const h of holders) console.log(`  • ${h.name} <${h.email}>${h.role === 'leader' ? ' (leader)' : ''}`);
    }
    return;
  }

  if (!email) {
    console.error('Usage: npm run set-vocal-director -- <email> [--revoke]');
    console.error('       npm run set-vocal-director -- --list');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, status: true, vocalDirector: true },
  });

  if (!user) {
    console.error(`No user with email ${email}. (Members are created from the leader Members page.)`);
    process.exitCode = 1;
    return;
  }

  if (user.vocalDirector === !revoke) {
    console.log(`${user.name} <${user.email}> already ${revoke ? 'does not have' : 'has'} the vocal-director capability. Nothing to do.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { vocalDirector: !revoke } });

  console.log(`${revoke ? 'Revoked' : 'Granted'}: ${user.name} <${user.email}> ${revoke ? 'can no longer' : 'can now'} edit vocal parts.`);
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
