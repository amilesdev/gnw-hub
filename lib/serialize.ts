import type {
  Event,
  EventAssignment,
  Announcement,
  PrayerRequest,
  Poll,
  PollChoice,
  Call,
  VocalPart,
  Unavailability,
} from '@prisma/client';
import { toYmd } from '@/lib/dates';
import type { RehearsalScheduleItem } from '@/lib/rehearsal-schedule';

// One assigned singer. The display name is resolved at read time, so renaming a
// member updates every event without touching the assignment rows.
export type EventAssignmentDTO = { userId: string; name: string; part: VocalPart };

// One row of a rehearsal run-of-show (see lib/rehearsal-schedule for the full
// shape: time, label, and an optional setlist-linked songSlot).
export type RehearsalScheduleItemDTO = RehearsalScheduleItem;

// Coerce the stored JSON (Prisma.JsonValue) into a well-formed schedule array,
// tolerating legacy nulls / unexpected shapes. Preserves songSlot so song-review
// rows stay live-linked to the setlist.
function parseRehearsalSchedule(value: unknown): RehearsalScheduleItemDTO[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => {
      const item: RehearsalScheduleItemDTO = { time: String(x.time ?? ''), label: String(x.label ?? '') };
      const slot = x.songSlot;
      if (typeof slot === 'number' && Number.isFinite(slot) && slot > 0) item.songSlot = Math.trunc(slot);
      return item;
    });
}

// Spread onto every event read so the serialized event always carries its
// assignments (an event read without it just serializes to an empty list).
export const eventInclude = {
  assignments: { include: { user: { select: { name: true } } } },
} as const;

type EventWithAssignments = Event & {
  assignments?: (EventAssignment & { user: { name: string } })[];
};

// Sopranos, then altos, then tenors; alphabetical within a part.
const PART_ORDER: Record<VocalPart, number> = { Soprano: 0, Alto: 1, Tenor: 2 };

// Shapes sent to the client (Dates → ISO strings). `rehearsalSchedule` is
// re-typed off the raw Prisma JsonValue into the structured item array.
export type EventDTO = Omit<Event, 'date' | 'createdAt' | 'updatedAt' | 'rehearsalSchedule'> & {
  date: string;
  createdAt: string;
  updatedAt: string;
  rehearsalSchedule: RehearsalScheduleItemDTO[];
  assignments: EventAssignmentDTO[];
};

export function serializeEvent(e: EventWithAssignments): EventDTO {
  const { assignments, rehearsalSchedule, ...rest } = e;
  return {
    ...rest,
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    rehearsalSchedule: parseRehearsalSchedule(rehearsalSchedule),
    assignments: (assignments ?? [])
      .map((a) => ({ userId: a.userId, name: a.user.name, part: a.part }))
      .sort((a, b) => PART_ORDER[a.part] - PART_ORDER[b.part] || a.name.localeCompare(b.name)),
  };
}

export type AnnouncementDTO = Omit<Announcement, 'expiresAt' | 'createdAt' | 'updatedAt'> & {
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  // Author's display name, or null for legacy/authorless posts.
  authorName: string | null;
};

// Accepts the announcement with its author relation optionally included.
export function serializeAnnouncement(a: Announcement & { author?: { name: string } | null }): AnnouncementDTO {
  const { author, ...rest } = a;
  return {
    ...rest,
    expiresAt: a.expiresAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    authorName: author?.name ?? null,
  };
}

// --- Polls -----------------------------------------------------------------

export type PollChoiceDTO = { id: string; position: number; text: string };

// Shape shown while voting (no tallies — results are hidden until you vote).
export type PollDTO = {
  id: string;
  question: string;
  multiple: boolean;
  endsAt: string;
  createdAt: string;
  choices: PollChoiceDTO[];
};

export type PollResultChoiceDTO = PollChoiceDTO & { votes: number };

// One voter and the choice(s) they picked. Leader-only — populated for the
// review surface so leaders can see exactly who voted what.
export type PollVoterDTO = { userId: string; name: string; choiceIds: string[] };

// Shape shown once results are visible (after you vote, or to a leader).
export type PollResultsDTO = {
  id: string;
  question: string;
  multiple: boolean;
  endsAt: string;
  createdAt: string;
  ended: boolean;
  choices: PollResultChoiceDTO[];
  totalVotes: number; // sum across choices (multiple-answer can exceed voters)
  totalVoters: number; // distinct people who voted
  myChoiceIds: string[]; // the current viewer's selections ([] if not voted)
  voters?: PollVoterDTO[]; // per-voter breakdown; leader-only, omitted otherwise
};

type PollWithChoices = Poll & { choices: PollChoice[] };
type PollWithCounts = Poll & { choices: (PollChoice & { _count: { votes: number } })[] };

const byPosition = (a: PollChoice, b: PollChoice) => a.position - b.position;

export function serializePoll(p: PollWithChoices): PollDTO {
  return {
    id: p.id,
    question: p.question,
    multiple: p.multiple,
    endsAt: p.endsAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    choices: [...p.choices].sort(byPosition).map((c) => ({ id: c.id, position: c.position, text: c.text })),
  };
}

export function serializePollResults(
  p: PollWithCounts,
  opts: { totalVoters: number; myChoiceIds: string[]; voters?: PollVoterDTO[]; now?: Date },
): PollResultsDTO {
  const choices = [...p.choices].sort(byPosition).map((c) => ({
    id: c.id,
    position: c.position,
    text: c.text,
    votes: c._count.votes,
  }));
  return {
    id: p.id,
    question: p.question,
    multiple: p.multiple,
    endsAt: p.endsAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    ended: (opts.now ?? new Date()).getTime() >= p.endsAt.getTime(),
    choices,
    totalVotes: choices.reduce((sum, c) => sum + c.votes, 0),
    totalVoters: opts.totalVoters,
    myChoiceIds: opts.myChoiceIds,
    ...(opts.voters ? { voters: opts.voters } : {}),
  };
}

export type PrayerRequestDTO = Omit<PrayerRequest, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export function serializePrayerRequest(p: PrayerRequest): PrayerRequestDTO {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// A member's blackout date/range. Dates are plain "YYYY-MM-DD" (UTC calendar
// days) so the client can drop them straight into an <input type="date"> and
// format for display without re-parsing an ISO timestamp. `userName`/`part` are
// populated only on leader reads (the team overview) — omitted on a member
// reading their own list.
export type UnavailabilityDTO = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  userName?: string;
  part?: string | null;
};

export function serializeUnavailability(
  u: Unavailability & { user?: { name: string; part: string | null } },
): UnavailabilityDTO {
  return {
    id: u.id,
    userId: u.userId,
    startDate: toYmd(u.startDate),
    endDate: toYmd(u.endDate),
    reason: u.reason,
    ...(u.user ? { userName: u.user.name, part: u.user.part } : {}),
  };
}

export type CallDTO = Omit<Call, 'startedAt' | 'endedAt'> & {
  startedAt: string;
  endedAt: string | null;
  startedByName?: string;
};

export function serializeCall(c: Call & { startedBy?: { name: string } | null }): CallDTO {
  return {
    ...c,
    startedAt: c.startedAt.toISOString(),
    endedAt: c.endedAt ? c.endedAt.toISOString() : null,
    ...(c.startedBy ? { startedByName: c.startedBy.name } : {}),
  };
}
