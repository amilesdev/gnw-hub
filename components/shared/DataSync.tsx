'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { announceDataChanged, useDataChanged } from '@/lib/data-changed';

/** Coming back after at least this long refreshes what's on screen. */
const STALE_AFTER_MS = 30_000;

/**
 * Keeps what's on screen current (lib/data-changed). Server-rendered screens
 * re-render on every change; screens with their own copy listen themselves.
 * Sources besides saves: the service worker reporting a newer copy of a cached
 * read, and the app returning to the foreground after a while away.
 */
export function DataSync() {
  const router = useRouter();
  useDataChanged(() => router.refresh());

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS) {
        announceDataChanged();
      }
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'gnw-api-updated') announceDataChanged();
    };
    document.addEventListener('visibilitychange', onVisibility);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, []);

  return null;
}
