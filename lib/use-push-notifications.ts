'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { clearPushSyncMark, markPushSynced, syncPushSubscription } from '@/lib/use-push-sync';

// VAPID applicationServerKey must be a Uint8Array; the browser hands us the
// public key as a URL-safe base64 string in env.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac; disambiguate by touch support.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag on installed PWAs.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type PushStatus =
  | 'loading' // still figuring out support/subscription
  | 'unsupported' // browser has no Push API at all
  | 'needs-install' // iOS, but not added to Home Screen yet → push impossible
  | 'denied' // user blocked notifications in the browser
  | 'subscribed' // active subscription on this device
  | 'unsubscribed'; // supported & allowed, just not subscribed yet

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  // Resolve the initial status: support → iOS install gate → permission → sub.
  // The local subscription paints the toggle immediately; the server check that
  // follows runs in the background, so nothing waits on a round-trip.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported) {
        if (isIos() && !isStandalone()) {
          if (!cancelled) setStatus('needs-install');
        } else if (!cancelled) setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }

      let sub: PushSubscription | null = null;
      try {
        const reg = await navigator.serviceWorker.ready;
        sub = await reg.pushManager.getSubscription();
      } catch {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      if (cancelled) return;
      setStatus(sub ? 'subscribed' : 'unsubscribed');
      if (!sub) return;

      // "On for this device" used to be a claim about the browser alone. A device
      // can hold a live subscription the server has no row for — a POST that
      // failed after subscribe() succeeded, a row pruned on a 410, an endpoint
      // rotated away — and in that state the toggle read "on" forever while
      // nothing was ever delivered. Confirm with the server, and repair silently.
      try {
        const { registered } = await apiFetch<{ registered: boolean }>(
          `/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
        );
        if (cancelled || registered) return;
        const repaired = await syncPushSubscription({ force: true });
        // Only correct the toggle if the repair itself failed — then it's honest
        // about being off, and flipping it re-runs the whole subscribe flow.
        if (!cancelled && !repaired) setStatus('unsubscribed');
      } catch {
        // Offline or a transient failure: keep the local reading rather than
        // claiming notifications are off when they may well be working.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const subscribe = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'unsubscribed');
        return;
      }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error('Push is not configured (missing VAPID key).');

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const json = sub.toJSON();
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      // Server confirmed — start the re-sync throttle from here, so the app-open
      // check doesn't re-POST what we just registered.
      if (json.endpoint) markPushSynced(json.endpoint);
      setStatus('subscribed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable notifications.');
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch('/api/push/subscribe', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {}); // best-effort server cleanup
        await sub.unsubscribe();
      }
      // Drop the throttle record, so re-enabling later syncs straight away.
      clearPushSyncMark();
      setStatus('unsubscribed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable notifications.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, subscribe, unsubscribe };
}
