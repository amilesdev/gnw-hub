import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  serializeEvent,
  serializeAnnouncement,
  eventInclude,
  type EventDTO,
  type AnnouncementDTO,
} from '@/lib/serialize';
import { serializeSong, setlistInclude, type SongDTO } from '@/lib/setlist-serialize';
import { startOfToday, upcomingWindowEnd } from '@/lib/dates';
import { CACHE_TAGS, CACHE_TTL_SECONDS } from '@/lib/cache-tags';

// The home & dashboard screens are the most-visited surfaces, so their reads are
// cached in Next's Data Cache. Everything here is GLOBAL team data (identical for
// every user) — no session/user input — which is what makes shared caching safe.
// The pages stay dynamic (auth runs per request); only these DB reads are cached.
// Each cache is busted immediately by the matching revalidate* helper on write
// (see lib/cache-tags.ts) and, as a backstop, expires after CACHE_TTL_SECONDS.

export type ThisWeekSetlist = { month: string; songs: SongDTO[] } | null;

export const getUpcomingEvents = unstable_cache(
  async (): Promise<EventDTO[]> => {
    const events = await prisma.event.findMany({
      where: { date: { gte: startOfToday(), lte: upcomingWindowEnd() } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: eventInclude,
    });
    return events.map(serializeEvent);
  },
  ['home:upcoming-events'],
  // Also tagged with members: assignment names are resolved from the member
  // list, so a rename/removal has to bust this cache too.
  { tags: [CACHE_TAGS.events, CACHE_TAGS.members], revalidate: CACHE_TTL_SECONDS },
);

export const getActiveAnnouncements = unstable_cache(
  async (): Promise<AnnouncementDTO[]> => {
    const announcements = await prisma.announcement.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: { select: { name: true, image: true } } },
    });
    return announcements.map(serializeAnnouncement);
  },
  ['home:active-announcements'],
  { tags: [CACHE_TAGS.announcements], revalidate: CACHE_TTL_SECONDS },
);

/** Songs for the soonest event within the next 7 days that has a setlist (the "This Week's Setlist").
 *  Depends on both events (which event is soonest / its setlist link) and setlists
 *  (the songs), so it's tagged with both. */
export const getThisWeekSetlist = unstable_cache(
  async (): Promise<ThisWeekSetlist> => {
    const event = await prisma.event.findFirst({
      where: { date: { gte: startOfToday(), lte: upcomingWindowEnd() }, setlistId: { not: null } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: { setlist: { include: setlistInclude } },
    });
    if (!event?.setlist) return null;

    return { month: event.setlist.month, songs: event.setlist.songs.map(serializeSong) };
  },
  ['home:this-week-setlist'],
  { tags: [CACHE_TAGS.events, CACHE_TAGS.setlists], revalidate: CACHE_TTL_SECONDS },
);

export type LeaderAlerts = {
  pendingInvites: number;
};

/**
 * Leader home alerts: pending invites.
 */
export const getLeaderAlerts = unstable_cache(
  async (): Promise<LeaderAlerts> => {
    const pendingInvites = await prisma.user.count({ where: { status: 'pending' } });

    return { pendingInvites };
  },
  ['home:leader-alerts'],
  { tags: [CACHE_TAGS.members], revalidate: CACHE_TTL_SECONDS },
);
