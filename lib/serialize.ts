import type { Event, Announcement, PrayerRequest, Poll, PollChoice, Call } from '@prisma/client';

// Shapes sent to the client (Dates → ISO strings).
export type EventDTO = Omit<Event, 'date' | 'createdAt' | 'updatedAt'> & {
  date: string;
  createdAt: string;
  updatedAt: string;
};

export function serializeEvent(e: Event): EventDTO {
  return {
    ...e,
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
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
