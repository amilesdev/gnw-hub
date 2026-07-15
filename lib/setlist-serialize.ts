import type { Setlist, Song, SetlistSong, Event } from '@prisma/client';

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

// `id` is the library Song's id — the stable identity used for audio/lyric
// edits (PATCH /api/songs/[id]) and for reconciling a setlist's membership.
// `position` comes from the SetlistSong join (a song can sit at a different
// spot in each setlist that uses it).
export type SongDTO = {
  id: string;
  position: number;
  songTitle: string;
  artist: string | null;
  youtubeLink: string | null;
  driveLink: string | null;
  audioSoprano: string | null;
  audioAlto: string | null;
  audioTenor: string | null;
  audioAllParts: string | null;
  lyricChart: LyricChart | null;
  lyricDocUrl: string | null;
  lyricChartUpdatedAt: string | null;
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

// A setlist's song as read from the DB: the join row (carrying its position)
// with the library Song it points at.
export type SongJoin = SetlistSong & { song: Song };
type FullSetlist = Setlist & { songs: SongJoin[]; events: LinkedEvent[] };

// The Prisma `include` every setlist read should use, so the DTO always has the
// joined library songs (ordered) and linked events to serialize from.
export const setlistInclude = {
  songs: { include: { song: true }, orderBy: { position: 'asc' } },
  events: { select: { id: true, eventName: true, date: true, time: true } },
} as const;

/** Flatten a SetlistSong join (+ its library Song) into the wire DTO. */
export function serializeSong(row: SongJoin): SongDTO {
  const { song } = row;
  return {
    id: song.id,
    position: row.position,
    songTitle: song.songTitle,
    artist: song.artist,
    youtubeLink: song.youtubeLink,
    driveLink: song.driveLink,
    audioSoprano: song.audioSoprano,
    audioAlto: song.audioAlto,
    audioTenor: song.audioTenor,
    audioAllParts: song.audioAllParts,
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
