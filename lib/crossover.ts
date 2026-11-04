import { Prisma, type CrossoverKind, type CrossoverSeason, type Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendPush } from '@/lib/push';
import { serializeEvent, eventInclude, type EventDTO } from '@/lib/serialize';
import {
  crossoverKindToType,
  crossoverSeasonActive,
  easternToday,
  seasonYearForDate,
  visibleEvents,
} from '@/lib/crossover-season';

// Server half of Crossover (see lib/crossover-season.ts for the shared rules).

/** The very first season's sets, before there's a last year to copy. */
export const DEFAULT_SET_BUILD = [
  { name: 'Opening Number', minutes: null, position: 0 },
  { name: 'Set 1', minutes: null, position: 1 },
  { name: 'Set 2', minutes: null, position: 2 },
];

/**
 * The current season, created on first use from Sep 1 (Eastern) onward — with
 * its kickoff events (leaders Sep 1, everyone Oct 1), Dress Rehearsal + Setup
 * (Dec 30) and Crossover itself (Dec 31). Dec 30/31 reuse last year's time and
 * location when there was a last year. Returns null off-season (Jan–Aug).
 * Idempotent and race-safe: the unique `year` makes a second creator fail and
 * roll back its events, then it just reads the winner's row.
 */
export async function ensureCrossoverSeason(now: Date = new Date()): Promise<CrossoverSeason | null> {
  if (!crossoverSeasonActive(now)) return null;
  const { year } = easternToday(now);

  const existing = await prisma.crossoverSeason.findUnique({ where: { year } });
  if (existing) return existing;

  const lastYear = await prisma.event.findMany({
    where: { crossoverSeason: { year: year - 1 }, crossoverKind: { in: ['dress_rehearsal', 'crossover'] } },
    orderBy: { date: 'desc' },
  });
  const carry = (kind: CrossoverKind, fallbackTime: string) => {
    const prev = lastYear.find((e) => e.crossoverKind === kind);
    return { time: prev?.time ?? fallbackTime, location: prev?.location ?? 'TBD' };
  };
  // What else carries over: the set build (names + planned minutes, no songs or
  // singers) and the day-of / Dress Rehearsal schedules. Attire, looks and the
  // program start fresh.
  const previous = await prisma.crossoverSeason.findUnique({
    where: { year: year - 1 },
    include: { sets: { orderBy: { position: 'asc' } } },
  });
  const setBuild = previous?.sets.length
    ? previous.sets.map((s, i) => ({ name: s.name, minutes: s.minutes, position: i }))
    : DEFAULT_SET_BUILD;

  try {
    const season = await prisma.$transaction(async (tx) => {
      const created = await tx.crossoverSeason.create({
        data: {
          year,
          setsSeeded: true,
          sets: { create: setBuild },
          dayOfSchedule: previous?.dayOfSchedule ?? Prisma.DbNull,
          dressSchedule: previous?.dressSchedule ?? Prisma.DbNull,
        },
      });
      const base = { repeats: 'once' as const, crossoverSeasonId: created.id };
      const events: Prisma.EventCreateManyInput[] = [
        {
          ...base,
          eventName: "It's Crossover Season!",
          type: crossoverKindToType('other'),
          crossoverKind: 'other',
          crossoverLeadersOnly: true,
          date: new Date(Date.UTC(year, 8, 1)),
          time: '00:00',
          location: 'GNW Hub',
          notes: 'The Crossover tab is open for leaders. Get things ready before the team joins on Oct 1.',
        },
        {
          ...base,
          eventName: "It's Crossover Season!",
          type: crossoverKindToType('other'),
          crossoverKind: 'other',
          date: new Date(Date.UTC(year, 9, 1)),
          time: '00:00',
          location: 'GNW Hub',
          notes: `Crossover ${year} is on! Everything for Crossover lives in the Crossover tab.`,
        },
        {
          ...base,
          eventName: 'Dress Rehearsal + Setup',
          type: crossoverKindToType('dress_rehearsal'),
          crossoverKind: 'dress_rehearsal',
          date: new Date(Date.UTC(year, 11, 30)),
          ...carry('dress_rehearsal', '09:00'),
          notes: 'Everything gets set up, then the full dress rehearsal.',
        },
        {
          ...base,
          eventName: 'Crossover',
          type: crossoverKindToType('crossover'),
          crossoverKind: 'crossover',
          date: new Date(Date.UTC(year, 11, 31)),
          ...carry('crossover', '19:00'),
        },
      ];
      await tx.event.createMany({ data: events });
      return created;
    });
    return season;
  } catch (err) {
    // Another request created this year's season first — use theirs.
    if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') {
      return prisma.crossoverSeason.findUnique({ where: { year } });
    }
    throw err;
  }
}

/**
 * The season a Crossover event dated `date` belongs to: its Sep–Dec year must be
 * the running season (created on demand) or one that already exists. Null when
 * the date can't be a Crossover date.
 */
export async function seasonForEventDate(date: Date): Promise<CrossoverSeason | null> {
  const year = seasonYearForDate(date);
  if (year == null) return null;
  const current = await ensureCrossoverSeason();
  if (current?.year === year) return current;
  return prisma.crossoverSeason.findUnique({ where: { year } });
}

export type CrossoverData = { year: number; season: CrossoverSeason; events: EventDTO[] };

/** The running season and every one of its events this viewer may see, oldest first. */
export async function getCrossoverData(role: Role): Promise<CrossoverData | null> {
  const season = await ensureCrossoverSeason();
  if (!season) return null;
  const events = await prisma.event.findMany({
    where: { crossoverSeasonId: season.id },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    include: eventInclude,
  });
  return { year: season.year, season, events: visibleEvents(events.map(serializeEvent), role) };
}

// A kickoff push still goes out if the cron missed the day itself, but not
// weeks later (e.g. when the feature first shipped mid-season).
const KICKOFF_GRACE_DAYS = 7;

/**
 * Send the "It's Crossover Season!" pushes that are due: leaders from Sep 1,
 * members from Oct 1. Each is claimed with a conditional update before sending,
 * so concurrent or repeated cron runs send it once. Called every few minutes by
 * GET /api/crossover/kickoff.
 */
export async function sendDueKickoffs(now: Date = new Date()): Promise<{ leaders: boolean; members: boolean }> {
  const season = await ensureCrossoverSeason(now);
  if (!season) return { leaders: false, members: false };
  const { year, month, day } = easternToday(now);
  const today = Date.UTC(year, month - 1, day);
  const due = (kickoff: number) => today >= kickoff && today < kickoff + KICKOFF_GRACE_DAYS * 86_400_000;

  async function claimAndSend(
    field: 'leaderKickoffSentAt' | 'memberKickoffSentAt',
    role: Role,
    body: string,
    url: string,
  ): Promise<boolean> {
    const claimed = await prisma.crossoverSeason.updateMany({
      where: { id: season!.id, [field]: null },
      data: { [field]: now },
    });
    if (claimed.count === 0) return false;
    const users = await prisma.user.findMany({ where: { role, status: 'active' }, select: { id: true } });
    await sendPush({ title: "It's Crossover Season!", body, url, tag: `crossover-kickoff-${year}` }, users.map((u) => u.id));
    return true;
  }

  const leaders =
    !season.leaderKickoffSentAt && due(Date.UTC(year, 8, 1))
      ? await claimAndSend(
          'leaderKickoffSentAt',
          'leader',
          `The Crossover ${year} tab is open for leaders. Get things ready before the team joins on Oct 1.`,
          '/dashboard/crossover',
        )
      : false;
  const members =
    !season.memberKickoffSentAt && due(Date.UTC(year, 9, 1))
      ? await claimAndSend(
          'memberKickoffSentAt',
          'member',
          `Crossover ${year} is on! Rehearsals, sets and everything else now live in the Crossover tab.`,
          '/home/crossover',
        )
      : false;
  return { leaders, members };
}
