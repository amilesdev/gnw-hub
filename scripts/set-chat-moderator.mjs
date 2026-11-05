/* GNW Hub — grant or revoke the chat-moderator capability.
 *
 * A chat moderator can delete anyone's message, remove people from a chat, and
 * archive a chat or topic. Nothing else: it grants no leader powers. The super
 * admin is always a moderator without this flag. See lib/access.ts →
 * canModerateChat.
 *
 * This is deliberately a backend-only switch — there is no toggle in the app.
 *
 * Run (inside GNW-Hub/):
 *   npm run set-chat-moderator -- <email>            # grant
 *   npm run set-chat-moderator -- <email> --revoke   # revoke
 *   npm run set-chat-moderator -- --list             # who currently holds it
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
      where: { chatModerator: true },
      select: { name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    if (!holders.length) {
      console.log('No one currently has the chat-moderator capability.');
    } else {
      console.log('Chat moderators:');
      for (const h of holders) console.log(`  • ${h.name} <${h.email}>${h.role === 'leader' ? ' (leader)' : ''}`);
    }
    return;
  }

  if (!email) {
    console.error('Usage: npm run set-chat-moderator -- <email> [--revoke]');
    console.error('       npm run set-chat-moderator -- --list');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, status: true, chatModerator: true },
  });

  if (!user) {
    console.error(`No user with email ${email}. (Members are created from the leader Members page.)`);
    process.exitCode = 1;
    return;
  }

  if (user.chatModerator === !revoke) {
    console.log(`${user.name} <${user.email}> already ${revoke ? 'does not have' : 'has'} the chat-moderator capability. Nothing to do.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { chatModerator: !revoke } });

  console.log(`${revoke ? 'Revoked' : 'Granted'}: ${user.name} <${user.email}> ${revoke ? 'can no longer' : 'can now'} moderate chat.`);
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
