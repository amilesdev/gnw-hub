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
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    include: { author: { select: { name: true } } },
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
  pendingInvites: number;
};

/**
 * Leader home alerts: pending invites.
 */
export async function getLeaderAlerts(): Promise<LeaderAlerts> {
  const pendingInvites = await prisma.user.count({ where: { status: 'pending' } });

  return { pendingInvites };
}
