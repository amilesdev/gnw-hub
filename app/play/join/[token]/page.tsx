import { prisma } from '@/lib/prisma';
import { GuestJoin } from '@/components/play/GuestJoin';

export const dynamic = 'force-dynamic';

// Public guest join page — outside Hub auth (spec §4.5). Validates the token
// server-side so an invalid/expired link shows a clear message.
export default async function GuestJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await prisma.gameSession.findFirst({
    where: { guestLinkToken: token, guestAccessEnabled: true },
    select: { status: true },
  });

  const state: 'open' | 'started' | 'invalid' =
    !session ? 'invalid' : session.status === 'lobby' ? 'open' : 'started';

  return <GuestJoin token={token} state={state} />;
}
