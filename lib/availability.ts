import { prisma } from '@/lib/prisma';
import { sendPush } from '@/lib/push';
import { formatEventDate } from '@/lib/dates';

/**
 * Which users are marked away on a given UTC calendar day. A block covers the
 * day when its inclusive [startDate, endDate] range contains it. Returned as a
 * Set for O(1) membership checks in the assignment picker.
 */
export async function unavailableUserIdsForDate(date: Date): Promise<Set<string>> {
  const rows = await prisma.unavailability.findMany({
    where: { startDate: { lte: date }, endDate: { gte: date } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Fire a push to every leader when a member marks themselves away on a date they
 * are *already assigned to sing* — the spot now needs re-covering. Only Service
 * events carry singing assignments, so that's the only conflict surface. Best
 * effort: never throws (a push failure must not fail the availability save).
 */
export async function notifyLeadersOfAssignmentConflict(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  try {
    const clashes = await prisma.eventAssignment.findMany({
      where: {
        userId,
        event: { type: 'service', date: { gte: startDate, lte: endDate } },
      },
      select: {
        part: true,
        user: { select: { name: true } },
        event: { select: { date: true, eventName: true } },
      },
      orderBy: { event: { date: 'asc' } },
    });
    if (clashes.length === 0) return;

    const leaders = await prisma.user.findMany({
      where: { role: 'leader', status: 'active' },
      select: { id: true },
    });
    if (leaders.length === 0) return;

    const name = clashes[0].user.name;
    const first = clashes[0];
    const more = clashes.length - 1;
    const body =
      `${name} is now unavailable for ${formatEventDate(first.event.date)} ` +
      `(assigned on ${first.part})` +
      (more > 0 ? ` and ${more} other assigned ${more === 1 ? 'date' : 'dates'}.` : '.');

    await sendPush(
      { title: 'Scheduling conflict', body, url: '/dashboard/events', tag: `avail-conflict-${userId}` },
      leaders.map((l) => l.id),
    );
  } catch (err) {
    console.error('[availability] conflict notify failed:', err);
  }
}
