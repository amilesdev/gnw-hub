import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { getProductionScreenData } from '@/lib/production/server';

// GET /api/production?event=<id> — the Production screen's data for one event
// (default: the next upcoming one). Templates are included for leaders only. An
// event the caller can't see (a Crossover event not open to members yet) is
// treated like an unknown id: the screen falls back to the next visible event.
export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const eventId = new URL(req.url).searchParams.get('event');
  const data = await getProductionScreenData(eventId, guard.user.role);
  return NextResponse.json(data);
}
