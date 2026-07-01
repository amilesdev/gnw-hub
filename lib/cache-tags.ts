import { revalidateTag } from 'next/cache';

/**
 * Cache tags for the *globally-shared* team data read by the home/dashboard
 * screens (lib/home-data.ts). This data is identical for every user, so caching
 * it is safe. NEVER cache user-specific data (session, own profile) under these.
 *
 * Each read is cached with both a tag (below) and a short time limit. Mutation
 * route handlers call the matching `revalidate*` helper after a successful write
 * so the next read rebuilds from the database instead of serving a stale copy.
 */
export const CACHE_TAGS = {
  events: 'events',
  announcements: 'announcements',
  setlists: 'setlists',
  members: 'members',
} as const;

/** How long a cached read may be served before it's refetched, regardless of
 *  tag invalidation. A safety net for the few changes that don't flow through a
 *  mutation route (e.g. recurring-window top-up, setlist auto-expiry) and for the
 *  date-boundary in "today"-relative queries. */
export const CACHE_TTL_SECONDS = 60;

/** Events changed (created/edited/deleted). Also refreshes "this week's setlist",
 *  which is tagged with `events` too. */
export function revalidateEvents() {
  revalidateTag(CACHE_TAGS.events);
}

/** Announcements changed (created/edited/deleted/pinned). */
export function revalidateAnnouncements() {
  revalidateTag(CACHE_TAGS.announcements);
}

/** Setlists or songs changed. Setlists also surface on upcoming events
 *  (event.setlistId), so refresh the events tag as well. */
export function revalidateSetlists() {
  revalidateTag(CACHE_TAGS.setlists);
  revalidateTag(CACHE_TAGS.events);
}

/** Membership changed in a way that can move the pending-invite count
 *  (invite created/claimed, member edited/removed). */
export function revalidateMembers() {
  revalidateTag(CACHE_TAGS.members);
}
