import { NextResponse } from 'next/server';

// GET /api/push/key — the public VAPID key. Only the service worker uses this,
// when it has to re-subscribe after the push service rotates an endpoint and the
// browser doesn't expose the old subscription's applicationServerKey (Safari).
// Deliberately unauthenticated: this key is public by design (it already ships to
// every browser as NEXT_PUBLIC_VAPID_PUBLIC_KEY), and a push event can fire when
// no valid session cookie is available.
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ error: 'Push is not configured' }, { status: 503 });
  return NextResponse.json({ key });
}
