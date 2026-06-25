import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@/lib/validation';

// POST /api/push/subscribe — save (or refresh) this device's push subscription,
// bound to the signed-in user. Idempotent on the browser endpoint, so calling
// it repeatedly from the same device is safe.
export async function POST(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = pushSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid subscription' },
      { status: 400 },
    );
  }

  const { endpoint, keys, userAgent } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
      userId: guard.user.id,
    },
    // Re-bind to the current user (e.g. shared device) and refresh keys.
    update: { p256dh: keys.p256dh, auth: keys.auth, userAgent, userId: guard.user.id },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/push/subscribe — remove this device's subscription. Scoped to the
// signed-in user so you can only delete your own.
export async function DELETE(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = pushUnsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: guard.user.id },
  });

  return NextResponse.json({ ok: true });
}
