'use client';

import { useEffect } from 'react';

/**
 * Keeps the server's copy of this device's push subscription alive.
 *
 * The browser subscription and our PushSubscription row can drift apart, and
 * every way they do is silent and permanent: the POST in `subscribe()` can fail
 * after the browser subscription was already created, `sendPush` prunes rows on
 * 404/410, and a shared device re-binds an endpoint to whoever subscribed last.
 * Once the row is gone nothing ever re-adds it — and the Profile toggle, which
 * reads local browser state, still says "On for this device". So the user sees
 * notifications enabled and simply never receives anything.
 *
 * Re-POSTing the local subscription on app open repairs all of that: the route
 * upserts on endpoint, so it's a no-op when things are already in order.
 */

const THROTTLE_KEY = 'gnw-push-synced';
const THROTTLE_MS = 24 * 60 * 60 * 1000;

type SyncRecord = { endpoint: string; at: number };

/** Skip the request when we already synced THIS endpoint recently. A new or
 *  rotated endpoint never matches, so it syncs immediately. */
function syncedRecently(endpoint: string): boolean {
  try {
    const raw = localStorage.getItem(THROTTLE_KEY);
    if (!raw) return false;
    const rec = JSON.parse(raw) as SyncRecord;
    return rec.endpoint === endpoint && Date.now() - rec.at < THROTTLE_MS;
  } catch {
    return false;
  }
}

/** Record a successful server-side registration for this endpoint. */
export function markPushSynced(endpoint: string): void {
  try {
    localStorage.setItem(THROTTLE_KEY, JSON.stringify({ endpoint, at: Date.now() }));
  } catch {
    // Private mode / quota — worst case we sync again next open.
  }
}

/** Forget the throttle so the next open re-syncs (used when unsubscribing). */
export function clearPushSyncMark(): void {
  try {
    localStorage.removeItem(THROTTLE_KEY);
  } catch {
    // no-op
  }
}

/**
 * Push the local subscription to the server if there is one. Returns true when
 * the server holds a subscription for this device afterwards. Deliberately
 * quiet: this runs in the background and must never surface an error to the UI.
 */
export async function syncPushSubscription(opts?: { force?: boolean }): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    // No local subscription: nothing to sync, and nothing to repair — the toggle
    // will correctly read "off" and the user can turn it back on. This is also
    // what keeps signed-out visitors from ever making a request here.
    if (!sub) return false;

    if (!opts?.force && syncedRecently(sub.endpoint)) return true;

    const json = sub.toJSON();
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      }),
    });

    // Only remember a genuine success. A 401 (signed out) or a network blip must
    // retry on the next open rather than being throttled away for a day.
    if (!res.ok) return false;
    markPushSynced(sub.endpoint);
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs the re-sync once per app open, after the app has settled. Mounted app-wide
 * so it repairs devices whose owners have no reason to visit Profile — they think
 * notifications already work. Costs at most one backgrounded request per device
 * per day, and none at all for anyone without a local subscription.
 */
export function usePushSync(): void {
  useEffect(() => {
    // The service worker is only registered in production, so `ready` would never
    // resolve in dev — matches ServiceWorkerRegistrar.
    if (process.env.NODE_ENV !== 'production') return;

    let cancelled = false;
    const run = () => {
      if (!cancelled) void syncPushSubscription();
    };

    // Wait for idle so this never competes with the first screen's data fetches.
    const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    if (ric) {
      const handle = ric(run, { timeout: 10_000 });
      return () => {
        cancelled = true;
        const cic = (window as Window & { cancelIdleCallback?: typeof cancelIdleCallback })
          .cancelIdleCallback;
        cic?.(handle);
      };
    }

    // Safari has no requestIdleCallback — a timer is close enough here.
    const timer = window.setTimeout(run, 3_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);
}
