import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { announcementSchema } from '@/lib/validation';
import { serializeAnnouncement } from '@/lib/serialize';

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
  return NextResponse.json({ announcement: serializeAnnouncement(announcement) }, { status: 201 });
}
