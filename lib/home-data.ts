import { prisma } from '@/lib/prisma';
import { serializeEvent, serializeAnnouncement, type EventDTO, type AnnouncementDTO } from '@/lib/serialize';
import type { LyricChart, SongDTO } from '@/lib/setlist-serialize';
import { startOfToday, upcomingWindowEnd } from '@/lib/dates';
import type { Song } from '@prisma/client';

function toSongDTO(s: Song): SongDTO {
  return {
    id: s.id,
    position: s.position,
    songTitle: s.songTitle,
    artist: s.artist,
    youtubeLink: s.youtubeLink,
    driveLink: s.driveLink,
    audioSoprano: s.audioSoprano,
    audioAlto: s.audioAlto,
    audioTenor: s.audioTenor,
    audioAllParts: s.audioAllParts,
    lyricChart: (s.lyricChart as LyricChart | null) ?? null,
    lyricDocUrl: s.lyricDocUrl,
    lyricChartUpdatedAt: s.lyricChartUpdatedAt?.toISOString() ?? null,
  };
}

export type ThisWeekSetlist = { month: string; songs: SongDTO[] } | null;

export async function getUpcomingEvents(): Promise<EventDTO[]> {
  const events = await prisma.event.findMany({
    where: { date: { gte: startOfToday(), lte: upcomingWindowEnd() } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });
  return events.map(serializeEvent);
}

export async function getActiveAnnouncements(): Promise<AnnouncementDTO[]> {
  const announcements = await prisma.announcement.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  return announcements.map(serializeAnnouncement);
}

/** Songs for the soonest event within the next 7 days that has a setlist (the "This Week's Setlist"). */
export async function getThisWeekSetlist(): Promise<ThisWeekSetlist> {
  const event = await prisma.event.findFirst({
    where: { date: { gte: startOfToday(), lte: upcomingWindowEnd() }, setlistId: { not: null } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    include: { setlist: { include: { songs: { orderBy: { position: 'asc' } } } } },
  });
  if (!event?.setlist) return null;

  return { month: event.setlist.month, songs: event.setlist.songs.map(toSongDTO) };
}

export type LeaderAlerts = {
  unfilledAudioSlots: number;
  unfilledSongs: number;
  expiringSoon: number;
  pendingInvites: number;
};

/**
 * Leader home alerts: unfilled audio this week, announcements expiring <24h, pending invites.
 * Takes the already-fetched `thisWeek` setlist to avoid re-querying it.
 */
export async function getLeaderAlerts(thisWeek: ThisWeekSetlist): Promise<LeaderAlerts> {
  const within24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [expiringSoon, pendingInvites] = await Promise.all([
    prisma.announcement.count({ where: { expiresAt: { gt: new Date(), lte: within24h } } }),
    prisma.user.count({ where: { status: 'pending' } }),
  ]);

  let unfilledAudioSlots = 0;
  let unfilledSongs = 0;
  for (const song of thisWeek?.songs ?? []) {
    const filled = [song.audioSoprano, song.audioAlto, song.audioTenor, song.audioAllParts].filter(Boolean).length;
    const missing = 4 - filled;
    if (missing > 0) {
      unfilledAudioSlots += missing;
      unfilledSongs += 1;
    }
  }

  return { unfilledAudioSlots, unfilledSongs, expiringSoon, pendingInvites };
}
