import { NextResponse } from 'next/server';
import type { Role, SongScope } from '@prisma/client';
import { crossoverOpenFor } from '@/lib/crossover-season';

/** Read `?scope=` (library by default). */
export function scopeParam(req: Request): SongScope {
  return new URL(req.url).searchParams.get('scope') === 'crossover' ? 'crossover' : 'library';
}

/** Crossover suggestions follow the Crossover season's visibility; library ones are always open. */
export function scopeClosed(scope: SongScope, role: Role): NextResponse | null {
  if (scope === 'crossover' && !crossoverOpenFor(role)) {
    return NextResponse.json({ error: 'Crossover isn’t open yet.' }, { status: 403 });
  }
  return null;
}
