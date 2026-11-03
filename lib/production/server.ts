import { Prisma, type EventType, type ProductionKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendPush } from '@/lib/push';
import { startOfToday, toYmd, formatTimeLabel } from '@/lib/dates';
import { eventStartInstant } from '@/lib/prayer-call';
import { HOTEL_SERVICE_MAP, SERVICE_TEMPLATE_TASKS } from './hotel-map';
import type {
  PackGroup,
  PackSingerDTO,
  PersonDTO,
  ProductionEventDTO,
  ProductionTaskDTO,
  StageMapData,
  StageMapDTO,
  TemplateDTO,
} from './types';

// Server side of Production: stage maps, checklists, in-ear packs and the
// 30-minute reminder. Checklists are created lazily (first time anyone opens
// the event's Production page, the Home card, or the reminder job), copying the
// type's template and last event's owners.

/** Event types that get a production checklist, and which template they use. */
export function productionKindFor(type: EventType): ProductionKind | null {
  if (type === 'service') return 'service';
  if (type === 'encounter_night') return 'encounter_night';
  if (type === 'other') return 'other';
  return null;
}
export const PRODUCTION_EVENT_TYPES: EventType[] = ['service', 'encounter_night', 'other'];

/** How long before an event's start its owners get the reminder push. */
export const REMINDER_LEAD_MS = 30 * 60_000;

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// ------------------------------------------------------------------ maps ----

/**
 * The stage map an event of this kind uses. Service seeds the hotel map on
 * first use. Encounter Night uses the Service map until it gets its own.
 * Other events have no stage map.
 */
export async function getActiveStageMap(kind: ProductionKind): Promise<StageMapDTO | null> {
  if (kind === 'other') return null;
  const own = await prisma.stageMap.findFirst({ where: { kind, active: true }, orderBy: { updatedAt: 'desc' } });
  if (own) return toMapDTO(own);
  if (kind === 'encounter_night') return getActiveStageMap('service');

  // Fixed id, so two requests seeding at once can't create two maps.
  try {
    const created = await prisma.stageMap.create({
      data: { id: SEEDED_MAP_ID, name: 'Hotel — Sunday Service', venue: 'Hotel', kind: 'service', data: HOTEL_SERVICE_MAP as unknown as Prisma.InputJsonValue },
    });
    return toMapDTO(created);
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return toMapDTO(await prisma.stageMap.findUniqueOrThrow({ where: { id: SEEDED_MAP_ID } }));
  }
}

const SEEDED_MAP_ID = 'seed-hotel-service';

function toMapDTO(m: { id: string; name: string; venue: string; data: Prisma.JsonValue }): StageMapDTO {
  return { id: m.id, name: m.name, venue: m.venue, data: m.data as unknown as StageMapData };
}

export async function saveStageMapData(id: string, data: StageMapData) {
  await prisma.stageMap.update({ where: { id }, data: { data: data as unknown as Prisma.InputJsonValue } });
}

// ------------------------------------------------------------- templates ----

/** Make sure every kind has a template. Service and Encounter Night start from the Service list. */
async function ensureTemplates() {
  const existing = await prisma.productionTemplate.findMany({ select: { kind: true } });
  const have = new Set(existing.map((t) => t.kind));
  const make = async (kind: ProductionKind, name: string, withTasks: boolean) => {
    if (have.has(kind)) return;
    // Fixed id per kind, so concurrent first loads can't seed a template twice.
    await prisma.productionTemplate.create({
      data: {
        id: `seed-template-${kind}`,
        kind,
        name,
        tasks: withTasks
          ? { create: SERVICE_TEMPLATE_TASKS.map((t, i) => ({ zone: t.zone, title: t.title, notes: t.notes ?? null, sortOrder: i })) }
          : undefined,
      },
    }).catch((err) => {
      if (!isUniqueViolation(err)) throw err;
    });
  };
  await make('service', 'Service', true);
  await make('encounter_night', 'Encounter Night', true);
  await make('other', 'Other', false);
}

export async function getTemplates(): Promise<TemplateDTO[]> {
  await ensureTemplates();
  const rows = await prisma.productionTemplate.findMany({
    include: { tasks: { orderBy: { sortOrder: 'asc' } } },
  });
  const order: ProductionKind[] = ['service', 'encounter_night', 'other'];
  return rows
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((t) => ({
      id: t.id,
      kind: t.kind,
      name: t.name,
      tasks: t.tasks.map((x) => ({ id: x.id, zone: x.zone, title: x.title, notes: x.notes, sortOrder: x.sortOrder })),
    }));
}

// ------------------------------------------------------------ checklists ----

/**
 * Create an event's checklist if it doesn't exist yet: the template's tasks,
 * each owned by whoever owned the same template task on the most recent
 * earlier event of the same type. Safe to call repeatedly or concurrently —
 * the EventProduction row (keyed by event) is the lock.
 */
export async function ensureChecklist(eventId: string): Promise<boolean> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, type: true, date: true, production: { select: { eventId: true } } } });
  if (!event) return false;
  const kind = productionKindFor(event.type);
  if (!kind) return false;
  if (event.production) return true;

  await ensureTemplates();
  const [template, map, previous] = await Promise.all([
    prisma.productionTemplate.findFirst({ where: { kind }, include: { tasks: { orderBy: { sortOrder: 'asc' } } } }),
    getActiveStageMap(kind),
    prisma.event.findFirst({
      where: { type: event.type, date: { lt: event.date }, production: { isNot: null } },
      orderBy: { date: 'desc' },
      select: { productionTasks: { select: { templateTaskId: true, owner: { select: { id: true, status: true } } } } },
    }),
  ]);

  const lastOwner = new Map<string, string>();
  for (const t of previous?.productionTasks ?? []) {
    if (t.templateTaskId && t.owner?.status === 'active') lastOwner.set(t.templateTaskId, t.owner.id);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.eventProduction.create({ data: { eventId, stageMapId: map?.id ?? null } });
      const tasks = template?.tasks ?? [];
      if (tasks.length) {
        await tx.productionTask.createMany({
          data: tasks.map((t) => ({
            eventId,
            templateTaskId: t.id,
            zone: t.zone,
            title: t.title,
            notes: t.notes,
            sortOrder: t.sortOrder,
            ownerId: lastOwner.get(t.id) ?? null,
          })),
        });
      }
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err; // someone else created it first
  }
  return true;
}

const taskInclude = { owner: { select: { name: true } }, doneBy: { select: { name: true } } } as const;
type TaskRow = Prisma.ProductionTaskGetPayload<{ include: typeof taskInclude }>;

export function serializeTask(t: TaskRow): ProductionTaskDTO {
  return {
    id: t.id,
    templateTaskId: t.templateTaskId,
    zone: t.zone,
    title: t.title,
    notes: t.notes,
    sortOrder: t.sortOrder,
    ownerId: t.ownerId,
    ownerName: t.owner?.name ?? null,
    doneAt: t.doneAt?.toISOString() ?? null,
    doneByName: t.doneBy?.name ?? null,
    oneOff: !t.templateTaskId,
  };
}

export async function getChecklist(eventId: string): Promise<ProductionTaskDTO[]> {
  await ensureChecklist(eventId);
  const rows = await prisma.productionTask.findMany({
    where: { eventId },
    include: taskInclude,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(serializeTask);
}

export async function getTask(id: string) {
  const t = await prisma.productionTask.findUnique({ where: { id }, include: taskInclude });
  return t;
}

// --------------------------------------------------------------- events ----

function toEventDTO(e: { id: string; eventName: string; type: EventType; date: Date; time: string }): ProductionEventDTO {
  return { id: e.id, eventName: e.eventName, type: e.type, date: e.date.toISOString(), time: e.time };
}

/** Upcoming events that carry production, soonest first. */
export async function getUpcomingProductionEvents(take = 8): Promise<ProductionEventDTO[]> {
  const rows = await prisma.event.findMany({
    where: { type: { in: PRODUCTION_EVENT_TYPES }, date: { gte: startOfToday() } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    take,
    select: { id: true, eventName: true, type: true, date: true, time: true },
  });
  return rows.map(toEventDTO);
}

export async function getProductionEvent(id: string): Promise<ProductionEventDTO | null> {
  const e = await prisma.event.findUnique({ where: { id }, select: { id: true, eventName: true, type: true, date: true, time: true } });
  return e && productionKindFor(e.type) ? toEventDTO(e) : null;
}

/** Active members, for the owner picker. */
export async function getPeople(): Promise<PersonDTO[]> {
  const rows = await prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true, image: true }, orderBy: { name: 'asc' } });
  return rows;
}

// ---------------------------------------------------------------- packs ----

/**
 * Who takes which in-ear pack: everyone assigned to sing, plus anyone leading
 * a song on the event's setlist. Leading a song → Lead pack; otherwise BGV.
 * Guests aren't members, so they never appear here.
 */
export async function getPackSingers(eventId: string): Promise<PackSingerDTO[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      assignments: { select: { part: true, user: { select: { id: true, name: true, image: true } } } },
      setlist: {
        select: {
          songs: {
            orderBy: { position: 'asc' },
            select: { song: { select: { songTitle: true } }, leads: { select: { user: { select: { id: true, name: true, image: true } } } } },
          },
        },
      },
    },
  });
  if (!event) return [];
  const people = new Map<string, PackSingerDTO>();
  for (const a of event.assignments) {
    people.set(a.user.id, { userId: a.user.id, name: a.user.name, image: a.user.image, part: a.part, leads: [], group: 'bgv' });
  }
  for (const s of event.setlist?.songs ?? []) {
    for (const l of s.leads) {
      const p = people.get(l.user.id) ?? { userId: l.user.id, name: l.user.name, image: l.user.image, part: null, leads: [], group: 'bgv' as PackGroup };
      p.leads.push(s.song.songTitle);
      p.group = 'lead';
      people.set(l.user.id, p);
    }
  }
  return [...people.values()].sort((a, b) => (a.group === b.group ? a.name.localeCompare(b.name) : a.group === 'lead' ? -1 : 1));
}

// ------------------------------------------------------------- home card ----

export type MyProductionTasks = { event: ProductionEventDTO; total: number; done: number; titles: string[] } | null;

/** The signed-in member's tasks on the next production event this week, for the Home card. */
export async function getMyProductionTasks(userId: string): Promise<MyProductionTasks> {
  const next = await prisma.event.findFirst({
    where: { type: { in: ['service', 'encounter_night'] }, date: { gte: startOfToday(), lte: new Date(startOfToday().getTime() + 6 * 86_400_000) } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    select: { id: true, eventName: true, type: true, date: true, time: true },
  });
  if (!next) return null;
  await ensureChecklist(next.id);
  const mine = await prisma.productionTask.findMany({
    where: { eventId: next.id, ownerId: userId },
    orderBy: { sortOrder: 'asc' },
    select: { title: true, doneAt: true },
  });
  if (!mine.length) return null;
  return { event: toEventDTO(next), total: mine.length, done: mine.filter((t) => t.doneAt).length, titles: mine.map((t) => t.title) };
}

// -------------------------------------------------------------- reminders ----

/**
 * Push each owner a reminder 30 minutes before their event starts. Called every
 * few minutes by .github/workflows/production-reminders.yml; sends at most once
 * per event (EventProduction.remindedAt). Owners with everything done are skipped.
 */
export async function sendDueReminders(now = new Date()): Promise<{ events: number; sent: number }> {
  const today = startOfToday();
  const events = await prisma.event.findMany({
    where: { type: { in: PRODUCTION_EVENT_TYPES }, date: today },
    select: { id: true, eventName: true, type: true, date: true, time: true },
  });
  let sentEvents = 0;
  let sent = 0;
  for (const e of events) {
    const start = eventStartInstant(toYmd(e.date), e.time);
    if (!start) continue;
    const msToStart = start.getTime() - now.getTime();
    if (msToStart > REMINDER_LEAD_MS || msToStart <= 0) continue;

    await ensureChecklist(e.id);
    // Claim the reminder first so overlapping runs can't double-send.
    const claimed = await prisma.eventProduction.updateMany({ where: { eventId: e.id, remindedAt: null }, data: { remindedAt: now } });
    if (claimed.count === 0) continue;

    const tasks = await prisma.productionTask.findMany({ where: { eventId: e.id, ownerId: { not: null }, doneAt: null }, select: { ownerId: true, title: true } });
    const byOwner = new Map<string, string[]>();
    for (const t of tasks) byOwner.set(t.ownerId!, [...(byOwner.get(t.ownerId!) ?? []), t.title]);
    for (const [ownerId, titles] of byOwner) {
      await sendPush(
        {
          title: `${e.eventName} starts at ${formatTimeLabel(e.time)}`,
          body: titles.length === 1 ? `Your production task: ${titles[0]}` : `You have ${titles.length} production tasks, starting with: ${titles[0]}`,
          url: `/production?event=${e.id}&tab=checklist`,
          tag: `production-${e.id}`,
        },
        [ownerId],
      );
      sent++;
    }
    sentEvents++;
  }
  return { events: sentEvents, sent };
}

// ---------------------------------------------------------------- screen ----

export type ProductionScreenData = {
  events: ProductionEventDTO[];
  event: ProductionEventDTO | null;
  map: StageMapDTO | null;
  tasks: ProductionTaskDTO[];
  singers: PackSingerDTO[];
  people: PersonDTO[];
  templates: TemplateDTO[] | null;
};

/** Everything the Production screen needs for one event (default: the next one). */
export async function getProductionScreenData(eventId: string | null, isLeader: boolean): Promise<ProductionScreenData> {
  const events = await getUpcomingProductionEvents();
  let event = eventId ? await getProductionEvent(eventId) : null;
  if (!event) event = events.find((e) => e.type !== 'other') ?? events[0] ?? null;
  if (event && !events.some((e) => e.id === event!.id)) events.unshift(event);

  const kind = event ? productionKindFor(event.type as EventType) : 'service';
  const [map, tasks, singers, people, templates] = await Promise.all([
    getActiveStageMap(kind ?? 'service'),
    event ? getChecklist(event.id) : Promise.resolve([]),
    event ? getPackSingers(event.id) : Promise.resolve([]),
    getPeople(),
    isLeader ? getTemplates() : Promise.resolve(null),
  ]);
  return { events, event, map, tasks, singers, people, templates };
}
