import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { serializeCall } from '@/lib/serialize';

// GET /api/calls/active — the currently-live call(s), newest first, so any
// authenticated user's client can discover a call to join. Open to everyone
// (no invite gating yet this pass).
export async function GET() {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const calls = await prisma.call.findMany({
    where: { status: 'active' },
    orderBy: { startedAt: 'desc' },
    include: { startedBy: { select: { name: true } } },
  });

  return NextResponse.json({ calls: calls.map(serializeCall) });
}
