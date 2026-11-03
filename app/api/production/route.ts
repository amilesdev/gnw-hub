import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { getProductionScreenData } from '@/lib/production/server';

// GET /api/production?event=<id> — the Production screen's data for one event
// (default: the next upcoming one). Templates are included for leaders only.
export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const eventId = new URL(req.url).searchParams.get('event');
  const data = await getProductionScreenData(eventId, guard.user.role === 'leader');
  return NextResponse.json(data);
}
