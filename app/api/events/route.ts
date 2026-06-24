import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { eventSchema } from '@/lib/validation';
import { serializeEvent } from '@/lib/serialize';
import { generateOccurrences, startOfToday, upcomingWindowEnd } from '@/lib/dates';
import { ensureRecurringWindow } from '@/lib/recurrence';
import { randomToken } from '@/lib/utils';

// GET /api/events?scope=upcoming|all|month&month=YYYY-MM
export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  // Keep each recurring series topped up to its rolling window before reading.
  await ensureRecurringWindow();

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') ?? 'all';
  const month = url.searchParams.get('month');

  let where: Record<string, unknown> = {};
  if (scope === 'upcoming') {
    where = { date: { gte: startOfToday(), lte: upcomingWindowEnd() } };
  } else if (scope === 'month' && month) {
    const [y, m] = month.split('-').map(Number);
    where = { date: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
  } else {
    // all upcoming/future from today onward
    where = { date: { gte: startOfToday() } };
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });

  return NextResponse.json({ events: events.map(serializeEvent) });
}

// POST /api/events — create event (and occurrences if recurring). Leader only.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const d = parsed.data;
  const seed = new Date(`${d.date}T00:00:00`);
  if (Number.isNaN(seed.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const dates = generateOccurrences(seed, d.repeats);
  // Recurring series share a seriesId so the UI can show them as one series
  // while each occurrence stays independently editable/deletable.
  const seriesId = d.repeats === 'once' ? null : randomToken(12);

  const isHolyTalks = d.type === 'holy_talks';

  const common = {
    eventName: d.eventName,
    type: d.type,
    time: d.time,
    location: d.location,
    repeats: d.repeats,
    notes: d.notes ?? null,
    seriesId,
    attirePrimary: d.attirePrimary ?? null,
    attirePrimaryHex: d.attirePrimaryHex ?? null,
    attireSecondary: d.attireSecondary ?? null,
    attireSecondaryHex: d.attireSecondaryHex ?? null,
    attireComplement: d.attireComplement ?? null,
    attireComplementHex: d.attireComplementHex ?? null,
    attireNotes: d.attireNotes ?? null,
    attirePhotos: d.attirePhotos ?? [],
    topic: isHolyTalks ? d.topic ?? null : null,
    scriptures: isHolyTalks ? d.scriptures ?? [] : [],
    holyTalksNotes: isHolyTalks ? d.holyTalksNotes ?? null : null,
  };

  // The seed occurrence keeps everything entered on the form. The other
  // occurrences in the initial window carry only the structural identity and
  // start blank for all per-occurrence content (attire, notes, topic), matching
  // how the rolling top-up materializes future ones.
  const extraDefaults = {
    notes: null,
    attirePrimary: null,
    attirePrimaryHex: null,
    attireSecondary: null,
    attireSecondaryHex: null,
    attireComplement: null,
    attireComplementHex: null,
    attireNotes: null,
    attirePhotos: [],
    topic: null,
    scriptures: [],
    holyTalksNotes: null,
  };

  const created = await prisma.$transaction(
    dates.map((date, i) =>
      prisma.event.create({ data: { ...common, ...(i === 0 ? {} : extraDefaults), date } }),
    ),
  );

  return NextResponse.json({ events: created.map(serializeEvent), count: created.length }, { status: 201 });
}
