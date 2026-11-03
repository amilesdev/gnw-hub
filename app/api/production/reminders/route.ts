import { NextResponse } from 'next/server';
import { sendDueReminders } from '@/lib/production/server';

// GET /api/production/reminders — pushes "your production tasks" to each owner
// 30 minutes before their event. Hit every 5 minutes by
// .github/workflows/production-reminders.yml with `Authorization: Bearer
// $CRON_SECRET`. Sends at most once per event, so extra calls are harmless.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await sendDueReminders();
  return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
}
