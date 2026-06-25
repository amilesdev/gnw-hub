import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { fetchPassage, ScriptureError } from '@/lib/nlt';

// GET /api/scripture?ref=John+3:16 — look up an NLT passage. Signed-in only.
//
// The NLT key lives server-side; the browser only ever talks to this route.
// We keep a tiny TRANSIENT in-memory cache (cleared on cold start) so repeat
// taps in a session don't re-hit the API. This is not persistent storage, so
// it stays within NLT's licensing terms (no DB caching of the text).

type Entry = { at: number; data: unknown };
const cache = new Map<string, Entry>();
const TTL = 1000 * 60 * 30; // 30 minutes
const MAX_ENTRIES = 200;

export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const ref = new URL(req.url).searchParams.get('ref')?.trim();
  if (!ref) return NextResponse.json({ error: 'Missing reference' }, { status: 400 });

  const cacheKey = ref.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json(hit.data);
  }

  try {
    const passage = await fetchPassage(ref);
    if (!passage) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const data = { passage };
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    const status = e instanceof ScriptureError ? e.status : 500;
    const error = e instanceof Error ? e.message : 'Scripture lookup failed.';
    return NextResponse.json({ error }, { status });
  }
}
