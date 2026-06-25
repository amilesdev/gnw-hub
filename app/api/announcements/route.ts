import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { announcementSchema } from '@/lib/validation';
import { serializeAnnouncement } from '@/lib/serialize';
import { sendPush } from '@/lib/push';

// GET /api/announcements — active (unexpired) announcements, newest first.
// Auto-expiry: anything past expiresAt is excluded from the query.
export async function GET() {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const announcements = await prisma.announcement.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ announcements: announcements.map(serializeAnnouncement) });
}

// POST /api/announcements — create. Leader only. Expiry capped at 10 days (validated).
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      expiresAt: new Date(parsed.data.expiresAt),
    },
  });

  // Optionally fan out as a push notification to the whole team. `notify` is a
  // transport flag (not part of the announcement record); zod strips it, so we
  // read it off the raw body. Best-effort — a push failure shouldn't fail the post.
  if (body?.notify) {
    await sendPush({ title: parsed.data.title, body: parsed.data.body, url: '/' }).catch(() => {});
  }

  return NextResponse.json({ announcement: serializeAnnouncement(announcement) }, { status: 201 });
}
