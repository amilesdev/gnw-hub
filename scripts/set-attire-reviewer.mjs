/* GNW Hub — grant or revoke the attire-reviewer capability.
 *
 * The attire reviewer approves members' submitted Crossover looks, or asks for
 * changes, from Crossover → Attire. Nothing else: it grants no leader powers.
 * See lib/access.ts → canReviewLooks.
 *
 * This is deliberately a backend-only switch — there is no toggle in the app.
 *
 * Run (inside GNW-Hub/):
 *   npm run set-attire-reviewer -- <email>            # grant
 *   npm run set-attire-reviewer -- <email> --revoke   # revoke
 *   npm run set-attire-reviewer -- --list             # who currently holds it
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
      where: { attireReviewer: true },
      select: { name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    if (!holders.length) {
      console.log('No one currently has the attire-reviewer capability.');
    } else {
      console.log('Attire reviewer:');
      for (const h of holders) console.log(`  • ${h.name} <${h.email}>${h.role === 'leader' ? ' (leader)' : ''}`);
    }
    return;
  }

  if (!email) {
    console.error('Usage: npm run set-attire-reviewer -- <email> [--revoke]');
    console.error('       npm run set-attire-reviewer -- --list');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, status: true, attireReviewer: true },
  });

  if (!user) {
    console.error(`No user with email ${email}. (Members are created from the leader Members page.)`);
    process.exitCode = 1;
    return;
  }

  if (user.attireReviewer === !revoke) {
    console.log(`${user.name} <${user.email}> already ${revoke ? 'does not have' : 'has'} the attire-reviewer capability. Nothing to do.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { attireReviewer: !revoke } });

  console.log(`${revoke ? 'Revoked' : 'Granted'}: ${user.name} <${user.email}> ${revoke ? 'can no longer' : 'can now'} review Crossover looks.`);
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
