/* GNW Hub — grant or revoke chat early access.
 *
 * While chat is in its soft launch (lib/access.ts → CHAT_OPEN_TO_MEMBERS is
 * false), only leaders and moderators can use it. Early access lets a member in
 * as a tester, so leaders get a feel for the member's side. They use chat
 * exactly as a member will: no creating chats, adding people, @all or
 * moderation. See lib/access.ts → canUseChat.
 *
 * This is deliberately a backend-only switch — there is no toggle in the app.
 * It stops mattering once CHAT_OPEN_TO_MEMBERS flips to true.
 *
 * Run (inside GNW-Hub/):
 *   npm run set-chat-early-access -- <email>            # grant
 *   npm run set-chat-early-access -- <email> --revoke   # revoke
 *   npm run set-chat-early-access -- --list             # who currently holds it
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
      where: { chatEarlyAccess: true },
      select: { name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    if (!holders.length) {
      console.log('No one currently has chat early access.');
    } else {
      console.log('Chat early access:');
      for (const h of holders) console.log(`  • ${h.name} <${h.email}>${h.role === 'leader' ? ' (leader)' : ''}`);
    }
    return;
  }

  if (!email) {
    console.error('Usage: npm run set-chat-early-access -- <email> [--revoke]');
    console.error('       npm run set-chat-early-access -- --list');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, status: true, chatEarlyAccess: true },
  });

  if (!user) {
    console.error(`No user with email ${email}. (Members are created from the leader Members page.)`);
    process.exitCode = 1;
    return;
  }

  if (user.chatEarlyAccess === !revoke) {
    console.log(`${user.name} <${user.email}> already ${revoke ? 'does not have' : 'has'} chat early access. Nothing to do.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { chatEarlyAccess: !revoke } });

  console.log(`${revoke ? 'Revoked' : 'Granted'}: ${user.name} <${user.email}> ${revoke ? 'can no longer' : 'can now'} use chat during the soft launch.`);
  if (revoke) {
    console.log('Note: they stay in their chats but stop seeing them, and stop getting pings and pushes.');
  }
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
