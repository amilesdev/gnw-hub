import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

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
