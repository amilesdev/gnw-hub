import type { Setlist, Song, Event } from '@prisma/client';

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
type FullSetlist = Setlist & { songs: Song[]; events: LinkedEvent[] };

export function serializeSetlist(s: FullSetlist): SetlistDTO {
  return {
    id: s.id,
    name: s.name,
    month: s.month,
    createdAt: s.createdAt.toISOString(),
    songs: [...s.songs]
      .sort((a, b) => a.position - b.position)
      .map((song) => ({
        id: song.id,
        position: song.position,
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
      })),
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
