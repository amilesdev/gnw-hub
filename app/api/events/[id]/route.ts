import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { eventSchema } from '@/lib/validation';
import { serializeEvent } from '@/lib/serialize';
import { parseCalendarDate } from '@/lib/dates';
import { deleteObjects, pathFromPublicUrl } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/[id] — single event (any authenticated user).
export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json({ event: serializeEvent(event) });
}

// PATCH /api/events/[id] — edit a single occurrence (leader only).
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = eventSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.eventName !== undefined) data.eventName = d.eventName;
  if (d.type !== undefined) data.type = d.type;
  if (d.date !== undefined) data.date = parseCalendarDate(d.date);
  if (d.time !== undefined) data.time = d.time;
  if (d.location !== undefined) data.location = d.location;
  if (d.notes !== undefined) data.notes = d.notes ?? null;
  // Editing one occurrence never re-generates the series.
  if (d.attirePrimary !== undefined) data.attirePrimary = d.attirePrimary ?? null;
  if (d.attirePrimaryHex !== undefined) data.attirePrimaryHex = d.attirePrimaryHex ?? null;
  if (d.attireSecondary !== undefined) data.attireSecondary = d.attireSecondary ?? null;
  if (d.attireSecondaryHex !== undefined) data.attireSecondaryHex = d.attireSecondaryHex ?? null;
  if (d.attireComplement !== undefined) data.attireComplement = d.attireComplement ?? null;
  if (d.attireComplementHex !== undefined) data.attireComplementHex = d.attireComplementHex ?? null;
  if (d.attireNotes !== undefined) data.attireNotes = d.attireNotes ?? null;
  if (d.attirePhotos !== undefined) data.attirePhotos = d.attirePhotos ?? [];

  // Holy Talks fields only meaningful when the (resulting) type is holy_talks.
  const resultingType = (d.type ?? existing.type) as string;
  if (resultingType === 'holy_talks') {
    if (d.topic !== undefined) data.topic = d.topic ?? null;
    if (d.scriptures !== undefined) data.scriptures = d.scriptures ?? [];
    if (d.holyTalksNotes !== undefined) data.holyTalksNotes = d.holyTalksNotes ?? null;
  } else if (d.type !== undefined) {
    // Switched away from holy_talks — clear those fields.
    data.topic = null;
    data.scriptures = [];
    data.holyTalksNotes = null;
  }

  // Clean up any attire photos that were removed from the array.
  if (d.attirePhotos !== undefined) {
    const removed = existing.attirePhotos.filter((u) => !d.attirePhotos!.includes(u));
    const paths = removed.map(pathFromPublicUrl).filter((p): p is string => !!p);
    if (paths.length) await deleteObjects(paths);
  }

  try {
    const event = await prisma.event.update({ where: { id }, data });
    return NextResponse.json({ event: serializeEvent(event) });
  } catch (err) {
    // Unique [seriesId, date]: this occurrence was moved onto a sibling's date.
    if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Another event in this series already falls on that date.' },
        { status: 409 },
      );
    }
    throw err;
  }
}

// DELETE /api/events/[id] — delete a single occurrence (leader only).
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Best-effort cleanup of this occurrence's attire photos.
  const paths = existing.attirePhotos.map(pathFromPublicUrl).filter((p): p is string => !!p);
  if (paths.length) await deleteObjects(paths);

  // For a recurring occurrence, remember this date as intentionally removed so
  // the rolling-window top-up doesn't resurrect it.
  if (existing.seriesId) {
    await prisma.seriesSkip.upsert({
      where: { seriesId_date: { seriesId: existing.seriesId, date: existing.date } },
      create: { seriesId: existing.seriesId, date: existing.date },
      update: {},
    });
  }

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
