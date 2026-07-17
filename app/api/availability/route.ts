import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { availabilitySchema } from '@/lib/validation';
import { serializeUnavailability } from '@/lib/serialize';
import { parseCalendarDate, startOfToday } from '@/lib/dates';
import { notifyLeadersOfAssignmentConflict, unavailableUserIdsForDate } from '@/lib/availability';

// GET /api/availability
//   (default)      → the current user's own blocks, upcoming first
//   ?scope=team    → leader-only; everyone's current/upcoming blocks with names
//   ?date=<ymd>    → leader-only; { userIds } of everyone away on that day (picker)
//   ?userId=<id>   → leader-only; one member's blocks (e.g. on the member's card)
export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const me = guard.user;

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope');
  const date = url.searchParams.get('date');
  const userId = url.searchParams.get('userId');
  const isLeader = me.role === 'leader';

  // Only surface blocks that haven't fully passed — a range still counts while
  // today is on or before its endDate.
  const notPast = { endDate: { gte: startOfToday() } };

  // Who's away on a single day — for the assignment picker's "Away" flag.
  if (date) {
    if (!isLeader) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const ids = await unavailableUserIdsForDate(parseCalendarDate(date));
    return NextResponse.json({ userIds: [...ids] });
  }

  if (scope === 'team') {
    if (!isLeader) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const rows = await prisma.unavailability.findMany({
      where: notPast,
      orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }],
      include: { user: { select: { name: true, part: true } } },
    });
    return NextResponse.json({ availability: rows.map(serializeUnavailability) });
  }

  // A specific member's list is leader-only; everyone else only sees their own.
  const targetId = userId && isLeader ? userId : me.id;
  const rows = await prisma.unavailability.findMany({
    where: { userId: targetId, ...notPast },
    orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }],
  });
  return NextResponse.json({ availability: rows.map(serializeUnavailability) });
}

// POST /api/availability — add a blackout date/range. A member marks their own;
// a leader may pass `userId` to mark it on a member's behalf.
export async function POST(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const me = guard.user;

  const body = await req.json().catch(() => null);
  const parsed = availabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const d = parsed.data;

  // Whose block this is: your own unless you're a leader naming someone else.
  const targetId = d.userId && me.role === 'leader' ? d.userId : me.id;

  const startDate = parseCalendarDate(d.startDate);
  const endDate = parseCalendarDate(d.endDate);

  const created = await prisma.unavailability.create({
    data: { userId: targetId, startDate, endDate, reason: d.reason?.trim() || null },
    include: { user: { select: { name: true, part: true } } },
  });

  // If this newly-away span covers a service they're already singing on, alert
  // the leaders so the spot can be re-covered. Best effort — never blocks the save.
  await notifyLeadersOfAssignmentConflict(targetId, startDate, endDate);

  return NextResponse.json({ availability: serializeUnavailability(created) }, { status: 201 });
}
