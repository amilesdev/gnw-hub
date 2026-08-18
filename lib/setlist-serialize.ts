import type { Setlist, Song, SetlistSong, SongLead, Event } from '@prisma/client';

// A single line of a parsed lyric chart. `section` lines are verse/chorus/etc.
// labels; `lyric` lines are sung text; `blank` lines are spacers.
export type LyricLine = {
  type: 'section' | 'lyric' | 'blank';
  text: string;
  bold: boolean;
};

export type LyricChart = {
  title: string;
  lines: LyricLine[];
  parsedAt: string; // ISO timestamp
};

// Someone leading a song. Name and photo travel with the id so every surface
// can render the person without a second lookup.
export type LeadDTO = { id: string; name: string; image: string | null };

// The user fields a lead row carries. Kept in one place so the Prisma `select`
// and the DTO can't drift apart.
export const leadUserSelect = { id: true, name: true, image: true } as const;

// `id` is the library Song's id — the stable identity used for audio/lyric
// edits (PATCH /api/songs/[id]) and for reconciling a setlist's membership.
// `position` and `leads` come from the SetlistSong join (a song can sit at a
// different spot — and be led by different people — in each setlist).
export type SongDTO = {
  id: string;
  position: number;
  leads: LeadDTO[];
  songTitle: string;
  artist: string | null;
  youtubeLink: string | null;
  audioSoprano: string | null;
  audioAlto: string | null;
  audioTenor: string | null;
  audioAllParts: string | null;
  arrangementAudio: string | null;
  songKey: string | null;
  bpm: string | null;
  lyricChart: LyricChart | null;
  lyricDocUrl: string | null;
  lyricChartUpdatedAt: string | null;
};

// A library song as shown on the Song Library screen: the reusable content plus
// how many setlists currently reference it (so a leader can tell what's in
// rotation vs. safe to retire). It's a SongDTO without the per-setlist
// `position`/`leads`, and with library-only metadata.
//
// `lastLeads` is who led it in the newest setlist that names anyone — the
// suggestion the setlist form pre-fills when the song is added again. Empty
// when the song has never had a lead.
export type LibrarySongDTO = Omit<SongDTO, 'position' | 'leads'> & {
  lastLeads: LeadDTO[];
  usageCount: number;
  updatedAt: string;
};

export type LinkedEventDTO = { id: string; eventName: string; date: string; time: string };

export type SetlistDTO = {
  id: string;
  name: string | null;
  month: string;
  songs: SongDTO[];
  events: LinkedEventDTO[];
  createdAt: string;
};

type LinkedEvent = Pick<Event, 'id' | 'eventName' | 'date' | 'time'>;

// A setlist's song as read from the DB: the join row (carrying its position and
// lead rows) with the library Song it points at.
export type SongJoin = SetlistSong & { song: Song; leads: (SongLead & { user: LeadDTO })[] };
type FullSetlist = Setlist & { songs: SongJoin[]; events: LinkedEvent[] };

// The Prisma `include` every setlist read should use, so the DTO always has the
// joined library songs (ordered, with their leads) and linked events to
// serialize from. Miss it and every song serializes with no leaders.
export const setlistInclude = {
  songs: {
    include: { song: true, leads: { include: { user: { select: leadUserSelect } } } },
    orderBy: { position: 'asc' },
  },
  events: { select: { id: true, eventName: true, date: true, time: true } },
} as const;

/**
 * Order setlists for a listing as one flat chronological list: soonest linked
 * event first, so the most immediate setlist (e.g. Aug 2) sits above later ones
 * (Aug 9) regardless of which was created first, and dates flow straight across
 * a month boundary with no grouping. Mutates and returns the array. Shared by
 * GET /api/setlists and its server-side mirror so the two stay in lockstep.
 */
export function sortSetlistsForListing<T extends { events: { date: Date }[] }>(setlists: T[]): T[] {
  const earliest = (s: T) => s.events.reduce((min, e) => Math.min(min, e.date.getTime()), Infinity);
  return setlists.sort((a, b) => earliest(a) - earliest(b));
}

/** Flatten a SetlistSong join (+ its library Song) into the wire DTO. */
export function serializeSong(row: SongJoin): SongDTO {
  const { song } = row;
  return {
    id: song.id,
    position: row.position,
    // Stable order so the same co-leads always read the same way on every screen.
    leads: [...row.leads].map((l) => l.user).sort((a, b) => a.name.localeCompare(b.name)),
    songTitle: song.songTitle,
    artist: song.artist,
    youtubeLink: song.youtubeLink,
    audioSoprano: song.audioSoprano,
    audioAlto: song.audioAlto,
    audioTenor: song.audioTenor,
    audioAllParts: song.audioAllParts,
    arrangementAudio: song.arrangementAudio,
    songKey: song.songKey,
    bpm: song.bpm,
    lyricChart: (song.lyricChart as LyricChart | null) ?? null,
    lyricDocUrl: song.lyricDocUrl,
    lyricChartUpdatedAt: song.lyricChartUpdatedAt?.toISOString() ?? null,
  };
}

export function serializeSetlist(s: FullSetlist): SetlistDTO {
  return {
    id: s.id,
    name: s.name,
    month: s.month,
    createdAt: s.createdAt.toISOString(),
    songs: [...s.songs].sort((a, b) => a.position - b.position).map(serializeSong),
    events: [...s.events]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((e) => ({ id: e.id, eventName: e.eventName, date: e.date.toISOString(), time: e.time })),
  };
}

export const AUDIO_PARTS = ['audioSoprano', 'audioAlto', 'audioTenor', 'audioAllParts'] as const;
export type AudioPart = (typeof AUDIO_PARTS)[number];

export const PART_LABELS: Record<AudioPart, string> = {
  audioSoprano: 'Soprano',
  audioAlto: 'Alto',
  audioTenor: 'Tenor',
  audioAllParts: 'All Parts',
};

export const PART_SLUG: Record<AudioPart, string> = {
  audioSoprano: 'soprano',
  audioAlto: 'alto',
  audioTenor: 'tenor',
  audioAllParts: 'all-parts',
};
