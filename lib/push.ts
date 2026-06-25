import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

// Web Push (VAPID). Mirrors lib/email.ts: if keys aren't configured (e.g. local
// dev), we no-op gracefully instead of throwing, so the rest of the app works.
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? 'mailto:alonzomilesjr1@gmail.com';

const configured = !!publicKey && !!privateKey;

if (configured) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where tapping the notification should open (handled by the service worker). */
  url?: string;
  /** Same tag replaces an existing notification instead of stacking a new one. */
  tag?: string;
};

/**
 * Send a notification to the given users (or everyone if `userIds` is omitted).
 * Fans out to every subscribed device, and prunes subscriptions the push
 * service reports as gone (404/410) so we stop sending to dead endpoints.
 */
export async function sendPush(
  payload: PushPayload,
  userIds?: string[],
): Promise<{ ok: boolean; sent?: number; skipped?: boolean }> {
  if (!configured) {
    console.warn(`[push] VAPID keys not set — skipping notification: ${payload.title}`);
    return { ok: true, skipped: true };
  }

  const subs = await prisma.pushSubscription.findMany({
    where: userIds ? { userId: { in: userIds } } : {},
  });
  if (subs.length === 0) return { ok: true, sent: 0 };

  const body = JSON.stringify(payload);

  const results = await Promise.all(
    subs.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        )
        .then(() => true)
        .catch(async (err: unknown) => {
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;
          // 404/410 = subscription expired or was unsubscribed → remove it.
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription
              .delete({ where: { endpoint: s.endpoint } })
              .catch(() => {});
          } else {
            console.error('[push] send failed:', statusCode ?? err);
          }
          return false;
        }),
    ),
  );

  return { ok: true, sent: results.filter(Boolean).length };
}
