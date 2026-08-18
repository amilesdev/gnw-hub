'use client';

import { usePushSync } from '@/lib/use-push-sync';

/**
 * Re-registers this device's push subscription with the server on app open, so a
 * device whose row went missing starts receiving notifications again without the
 * user having to notice anything was wrong. Renders nothing.
 *
 * Mounted in AppShell (rather than the root layout) because both authenticated
 * layouts render it — that keeps the request off the login screen entirely.
 */
export function PushSubscriptionSync() {
  usePushSync();
  return null;
}
