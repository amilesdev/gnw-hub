import { NextResponse } from 'next/server';
import { sendDueKickoffs } from '@/lib/crossover';

// GET /api/crossover/kickoff — opens the Crossover season and sends the "It's
// Crossover Season!" pushes when due (leaders Sep 1, members Oct 1, Eastern).
// Called by .github/workflows/production-reminders.yml (its crossover-kickoff
// job) only twice a day (~9:30am and ~5:30pm Eastern) on Sep 1–7 and Oct 1–7,
// with `Authorization: Bearer $CRON_SECRET`. That's ~14 attempts per push inside
// its 7-day grace window, so a missed GitHub run is recovered by the next one;
// keep that in mind before shortening the grace window or the run days. Each
// push is sent once, so extra calls are harmless.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sent = await sendDueKickoffs();
  return NextResponse.json({ ok: true, sent }, { headers: { 'Cache-Control': 'no-store' } });
}
