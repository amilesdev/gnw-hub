import type { CrossoverSeason, VocalPart } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { songToDTO, type SongDTO } from '@/lib/setlist-serialize';
import { DEFAULT_SET_BUILD } from '@/lib/crossover';

// Crossover sets: the season's setlist, built from named sets ("Opening
// Number", "Set 1", …) in running order. Each set holds Crossover-list songs
// and its singers (per set, with a part — not per song).

export type SetSingerDTO = { userId: string; name: string; image: string | null; part: VocalPart };

export type CrossoverSetDTO = {
  id: string;
  name: string;
  position: number;
  minutes: number | null;
  songs: SongDTO[];
  singers: SetSingerDTO[];
};

export const setInclude = {
  songs: { include: { song: true }, orderBy: { position: 'asc' } },
  singers: { include: { user: { select: { name: true, image: true } } } },
} as const;

// Sopranos, then altos, then tenors; alphabetical within a part.
const PART_ORDER: Record<VocalPart, number> = { Soprano: 0, Alto: 1, Tenor: 2 };

type SetRow = Awaited<ReturnType<typeof loadSets>>[number];

function serializeSet(s: SetRow): CrossoverSetDTO {
  return {
    id: s.id,
    name: s.name,
    position: s.position,
    minutes: s.minutes,
    songs: s.songs.map((row) => songToDTO(row.song, row.position)),
    singers: s.singers
      .map((x) => ({ userId: x.userId, name: x.user.name, image: x.user.image, part: x.part }))
      .sort((a, b) => PART_ORDER[a.part] - PART_ORDER[b.part] || a.name.localeCompare(b.name)),
  };
}

function loadSets(seasonId: string) {
  return prisma.crossoverSet.findMany({
    where: { seasonId },
    orderBy: { position: 'asc' },
    include: setInclude,
  });
}

/**
 * The season's sets, in running order. The first read of a season that was
 * opened before sets existed lays down the defaults (Opening Number, Set 1,
 * Set 2) once; claiming `setsSeeded` first means it never happens twice.
 */
export async function getSeasonSets(season: CrossoverSeason): Promise<CrossoverSetDTO[]> {
  if (!season.setsSeeded) {
    const claimed = await prisma.crossoverSeason.updateMany({
      where: { id: season.id, setsSeeded: false },
      data: { setsSeeded: true },
    });
    if (claimed.count === 1) {
      await prisma.crossoverSet.createMany({
        data: DEFAULT_SET_BUILD.map((s) => ({ ...s, seasonId: season.id })),
      });
    }
  }
  return (await loadSets(season.id)).map(serializeSet);
}
