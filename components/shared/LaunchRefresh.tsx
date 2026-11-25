'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Fast launch (Docs/Polish-Pass-Plan.md, phase 2): the service worker can paint
 * Home from the copy this device last saw (public/sw.js → serveHome). When it
 * does, it leaves a marker in its pages cache; this reads it once per page load
 * and, if Home really came from that cache, refreshes the data in place
 * (router.refresh keeps scroll and open sheets) behind an "Updating…" pill.
 * Offline it says so, with the time of the copy, instead of looking current.
 *
 * Keep LAUNCH_KEY and the `-pages` cache suffix in sync with public/sw.js.
 */
const LAUNCH_KEY = '/__gnw/launch';
/** A marker older than this belongs to some earlier launch, not this page load. */
const MARKER_MAX_AGE_MS = 15_000;
/**
 * Loop guard: when a refresh fails, Next falls back to a full reload, which the
 * service worker answers from cache again. A second try at the same copy within
 * this window means we're offline in practice (even if navigator.onLine says not).
 */
const RETRY_GAP_MS = 20_000;
const TRIED_KEY = 'gnw-launch-refresh';

type Launch = { path: string; cachedAt: number; servedAt: number };
type Status = { kind: 'idle' } | { kind: 'updating' | 'offline'; cachedAt: number };

// Module-level: once per document, so tab switches back to Home never re-check.
let checkedThisLoad = false;

async function takeLaunchMarker(): Promise<Launch | null> {
  try {
    if (!('caches' in window)) return null;
    const name = (await caches.keys()).find((n) => n.endsWith('-pages'));
    if (!name) return null;
    const cache = await caches.open(name);
    const res = await cache.match(LAUNCH_KEY);
    if (!res) return null;
    await cache.delete(LAUNCH_KEY); // one launch, one read
    const launch = (await res.json()) as Launch;
    const fresh = Date.now() - launch.servedAt < MARKER_MAX_AGE_MS;
    return fresh && launch.path === window.location.pathname ? launch : null;
  } catch {
    return null;
  }
}

function recentlyTried(cachedAt: number) {
  try {
    const [at, when] = (sessionStorage.getItem(TRIED_KEY) ?? '').split(':').map(Number);
    return at === cachedAt && Date.now() - when < RETRY_GAP_MS;
  } catch {
    return false;
  }
}

function markTried(cachedAt: number) {
  try {
    sessionStorage.setItem(TRIED_KEY, `${cachedAt}:${Date.now()}`);
  } catch {
    /* private mode: the guard just doesn't persist */
  }
}

function copyTime(at: number) {
  const d = new Date(at);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

export function LaunchRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const refreshing = useRef(false);

  useEffect(() => {
    if (checkedThisLoad) return;
    checkedThisLoad = true;
    let launch: Launch | null = null;

    const refresh = () => {
      if (!launch) return;
      if (!navigator.onLine || recentlyTried(launch.cachedAt)) {
        setStatus({ kind: 'offline', cachedAt: launch.cachedAt });
        return;
      }
      markTried(launch.cachedAt);
      setStatus({ kind: 'updating', cachedAt: launch.cachedAt });
      refreshing.current = true;
      startTransition(() => router.refresh());
    };
    const onOnline = () => {
      try {
        sessionStorage.removeItem(TRIED_KEY);
      } catch {
        /* ignore */
      }
      refresh();
    };

    takeLaunchMarker().then((l) => {
      launch = l;
      refresh();
    });
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [router]);

  // The refresh committed fresh data: drop the pill.
  useEffect(() => {
    if (refreshing.current && !pending) {
      refreshing.current = false;
      setStatus({ kind: 'idle' });
    }
  }, [pending]);

  if (status.kind === 'idle') return null;
  const offline = status.kind === 'offline';
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[45] flex justify-center px-4"
    >
      <span
        className={cn(
          'glass flex h-8 animate-fade-in items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold',
          offline ? 'text-warn-ink' : 'text-ink',
        )}
      >
        {offline ? (
          <>
            <span className="h-2 w-2 rounded-full bg-warn" aria-hidden />
            Offline · Home from {copyTime(status.cachedAt)}
          </>
        ) : (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
            Updating…
          </>
        )}
      </span>
    </div>
  );
}
