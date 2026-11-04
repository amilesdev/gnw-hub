import { NextResponse } from 'next/server';
import { sendDueKickoffs } from '@/lib/crossover';

// GET /api/crossover/kickoff — opens the Crossover season and sends the "It's
// Crossover Season!" pushes when due (leaders Sep 1, members Oct 1, Eastern).
// Hit every 5 minutes by .github/workflows/production-reminders.yml with
// `Authorization: Bearer $CRON_SECRET`. Each push is sent once, so extra calls
// are harmless.
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
