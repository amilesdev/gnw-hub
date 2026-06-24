import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { announcementSchema } from '@/lib/validation';
import { serializeAnnouncement } from '@/lib/serialize';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/announcements/[id] — edit. Leader only. 10-day cap re-validated.
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      expiresAt: new Date(parsed.data.expiresAt),
    },
  });
  return NextResponse.json({ announcement: serializeAnnouncement(announcement) });
}

// DELETE /api/announcements/[id] — leader only.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });

  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
