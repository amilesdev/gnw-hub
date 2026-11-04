import type { Song } from '@prisma/client';
import { leadUserSelect, type LeadDTO, type LibrarySongDTO, type LyricChart } from '@/lib/setlist-serialize';

// The rows Prisma hands back for a song's remembered leaders.
type LastLeadRow = { user: LeadDTO };

// The `include` a library read needs for `lastLeads` and the usage counts to
// come out populated.
export const libraryInclude = {
  _count: { select: { setlistSongs: true, crossoverSetSongs: true } },
  lastLeads: { include: { user: { select: leadUserSelect } } },
} as const;

type LibraryRow = Song & {
  _count?: { setlistSongs: number; crossoverSetSongs: number };
  lastLeads?: LastLeadRow[];
};

/**
 * Shape a song (+ its usage count and remembered leaders) into the wire DTO.
 * Usage counts setlists for a Song Library song and Crossover sets for a
 * Crossover-list song.
 */
export function toLibraryDTO(s: LibraryRow): LibrarySongDTO {
  const usageCount = s.scope === 'crossover' ? s._count?.crossoverSetSongs ?? 0 : s._count?.setlistSongs ?? 0;
  return {
    id: s.id,
    scope: s.scope,
    lastLeads: (s.lastLeads ?? []).map((l) => l.user).sort((a, b) => a.name.localeCompare(b.name)),
    songTitle: s.songTitle,
    artist: s.artist,
    youtubeLink: s.youtubeLink,
    audioSoprano: s.audioSoprano,
    audioAlto: s.audioAlto,
    audioTenor: s.audioTenor,
    audioAllParts: s.audioAllParts,
    arrangementAudio: s.arrangementAudio,
    songKey: s.songKey,
    bpm: s.bpm,
    lyricChart: (s.lyricChart as LyricChart | null) ?? null,
    lyricDocUrl: s.lyricDocUrl,
    lyricChartUpdatedAt: s.lyricChartUpdatedAt?.toISOString() ?? null,
    usageCount,
    updatedAt: s.updatedAt.toISOString(),
  };
}
