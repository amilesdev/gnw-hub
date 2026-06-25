import { NextResponse } from 'next/server';
import { requireLeader } from '@/lib/session';
import { pushSendSchema } from '@/lib/validation';
import { sendPush } from '@/lib/push';

// POST /api/push/send — manually send a push notification to the whole team.
// Leader only. Returns how many devices it reached so the UI can confirm.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = pushSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const result = await sendPush({
    title: parsed.data.title,
    body: parsed.data.body,
    url: parsed.data.url ?? '/',
  });

  return NextResponse.json({
    ok: true,
    sent: result.sent ?? 0,
    skipped: result.skipped ?? false,
  });
}
