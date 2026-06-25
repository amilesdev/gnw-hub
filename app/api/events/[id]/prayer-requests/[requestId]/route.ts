import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

type Ctx = { params: Promise<{ id: string; requestId: string }> };

// DELETE /api/events/[id]/prayer-requests/[requestId] — remove a request.
// Allowed for the request's author or any leader.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const { id, requestId } = await params;

  const request = await prisma.prayerRequest.findUnique({ where: { id: requestId } });
  if (!request || request.eventId !== id) {
    return NextResponse.json({ error: 'Prayer request not found' }, { status: 404 });
  }

  const isAuthor = request.authorId === guard.user.id;
  const isLeader = guard.user.role === 'leader';
  if (!isAuthor && !isLeader) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.prayerRequest.delete({ where: { id: requestId } });
  return NextResponse.json({ ok: true });
}
