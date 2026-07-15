import type { CallAudience } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Access rules for calls, shared by the token endpoint (join gating) and the
// active-calls endpoint (discovery gating) so both enforce the same policy.
//
// `all_members` calls are open to everyone. `leaders_only` calls are limited to
// users explicitly designated as call leaders (User.callLeader) plus whoever
// started the call — intentionally NOT tied to the `role: leader` tag.

/** Whether a single user may see / join a call, given its audience and starter. */
export async function canAccessCall(
  call: { audience: CallAudience; startedById: string },
  userId: string,
): Promise<boolean> {
  if (call.audience === 'all_members') return true;
  if (call.startedById === userId) return true;
  return isCallLeader(userId);
}

/** Whether a user carries the call-leader designation. */
export async function isCallLeader(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { callLeader: true },
  });
  return !!u?.callLeader;
}

/** IDs of every user designated as a call leader (recipients for leaders-only
 *  notifications). Returns an empty list until any are assigned. */
export async function callLeaderIds(): Promise<string[]> {
  const leaders = await prisma.user.findMany({
    where: { callLeader: true },
    select: { id: true },
  });
  return leaders.map((l) => l.id);
}
