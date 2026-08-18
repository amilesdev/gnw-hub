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

  const { endpoint, keys, userAgent, oldEndpoint } = parsed.data;
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

  // The push service rotated this device's endpoint — drop the superseded row so
  // we stop sending into the void. Scoped to this user, and never the row we just
  // wrote (a browser that reports the same endpoint as "old" isn't a rotation).
  if (oldEndpoint && oldEndpoint !== endpoint) {
    await prisma.pushSubscription
      .deleteMany({ where: { endpoint: oldEndpoint, userId: guard.user.id } })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

// GET /api/push/subscribe?endpoint=… — is THIS device's subscription actually
// registered to the signed-in user? The in-app toggle used to answer that from
// browser state alone, so a device whose row had gone missing (a failed POST, a
// pruned 410, a rotated endpoint) still showed "On for this device" forever and
// never self-healed. This is the server's side of that check.
export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const endpoint = new URL(req.url).searchParams.get('endpoint');
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  const existing = await prisma.pushSubscription.findFirst({
    where: { endpoint, userId: guard.user.id },
    select: { id: true },
  });

  return NextResponse.json({ registered: !!existing });
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
