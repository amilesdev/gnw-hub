import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

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
