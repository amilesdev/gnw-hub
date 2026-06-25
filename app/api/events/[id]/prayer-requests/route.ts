import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { prayerRequestSchema } from '@/lib/validation';
import { serializePrayerRequest } from '@/lib/serialize';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/[id]/prayer-requests — ongoing list for a prayer event,
// oldest first so the running list reads top-to-bottom. Any authenticated user.
export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const requests = await prisma.prayerRequest.findMany({
    where: { eventId: id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ prayerRequests: requests.map(serializePrayerRequest) });
}

// POST /api/events/[id]/prayer-requests — add a request. Open to any user
// (members and leaders); the author is taken from the session.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.type !== 'prayer') {
    return NextResponse.json({ error: 'Prayer requests are only for prayer events.' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = prayerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const request = await prisma.prayerRequest.create({
    data: {
      eventId: id,
      authorId: guard.user.id,
      authorName: guard.user.name ?? 'Anonymous',
      body: parsed.data.body.trim(),
    },
  });

  return NextResponse.json({ prayerRequest: serializePrayerRequest(request) }, { status: 201 });
}
