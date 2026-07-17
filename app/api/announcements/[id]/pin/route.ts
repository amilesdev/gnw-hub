import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { serializeAnnouncement } from '@/lib/serialize';
import { revalidateAnnouncements } from '@/lib/cache-tags';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/announcements/[id]/pin — pin or unpin. Leader only.
// Body: { pinned: boolean }. Pinned posts sort to the top of everyone's feed.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const pinned = body?.pinned;
  if (typeof pinned !== 'boolean') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });

  const announcement = await prisma.announcement.update({
    where: { id },
    data: { pinned },
    include: { author: { select: { name: true, image: true } } },
  });
  revalidateAnnouncements();
  return NextResponse.json({ announcement: serializeAnnouncement(announcement) });
}
