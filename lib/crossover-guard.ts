import { NextResponse } from 'next/server';
import { requireLeader, requireUser } from '@/lib/session';
import { ensureCrossoverSeason } from '@/lib/crossover';
import { crossoverOpenFor } from '@/lib/crossover-season';

/**
 * API guard for Crossover routes: a signed-in user the season is open for (and
 * a leader, when `leader` is set), plus the running season. Returns either
 * both or a ready error response.
 */
export async function requireCrossover(opts: { leader?: boolean } = {}) {
  const guard = opts.leader ? await requireLeader() : await requireUser();
  if ('error' in guard) return { error: guard.error };
  if (!crossoverOpenFor(guard.user.role)) {
    return { error: NextResponse.json({ error: 'Crossover isn’t open yet.' }, { status: 403 }) };
  }
  const season = await ensureCrossoverSeason();
  if (!season) return { error: NextResponse.json({ error: 'No Crossover season is running.' }, { status: 404 }) };
  return { user: guard.user, season };
}
