import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { canEditLyricCharts, canEditVocalParts } from '@/lib/access';

// Memoized per request: the session callback now does a DB revalidation, so
// several guards in one request (layout + page, or nested checks) share a single
// lookup instead of hitting the DB each time.
export const getSessionUser = cache(async () => {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
});

/** Throwable guard for API routes. Returns either a user or a NextResponse. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user };
}

export async function requireLeader() {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (user.role !== 'leader') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

/**
 * Guard for the vocal-part audio slots: leaders, plus the vocal director. It
 * only says the caller may touch the four `audio*` fields — routes that let one
 * through must still restrict WHICH fields a non-leader can write (see
 * app/api/songs/[id]/route.ts).
 */
export async function requireVocalPartEditor() {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!canEditVocalParts(user)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

/**
 * Guard for a song's lyric chart: leaders, plus the administrative assistant.
 * Like {@link requireVocalPartEditor}, it only says the caller may touch the
 * lyric-chart fields — routes that let one through must still restrict WHICH
 * fields a non-leader can write (see app/api/songs/[id]/route.ts).
 */
export async function requireLyricChartEditor() {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!canEditLyricCharts(user)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}
