/* GNW Hub — service worker.
 * Auth-gated app, so it caches carefully:
 *  • immutable hashed build assets + icons → cache-first
 *  • a small allowlist of GLOBAL, non-user-specific read APIs (events, setlists,
 *    announcements — identical for every member and leader) → stale-while-revalidate,
 *    so revisiting a screen paints instantly then refreshes in the background
 *  • page navigations (per-user HTML) and every other API → network-first / never
 *    cached, which keeps private and role-specific data off disk
 * Safety: only 200 same-origin responses are stored; a 401/403/redirect evicts any
 * stale copy; and ANY write or auth call (login/logout, POST/PATCH/DELETE to /api)
 * wipes the read cache, so nothing survives a sign-out/sign-in on a shared device.
 */
const VERSION = 'gnw-v3';
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

// Only these exact GET paths are cache-served. Each returns the same team-wide
// data to every authenticated user (no role- or user-specific fields), so a cached
// copy can never leak one user's data to another. Do NOT add user/role-specific or
// real-time endpoints here (e.g. /api/members, /api/polls/*, /api/play/*).
const API_SWR_PATHS = new Set(['/api/events', '/api/setlists', '/api/announcements']);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Writes and auth calls are never intercepted, but they invalidate the cached
  // read snapshots so the next read is fresh and no data survives a sign-out/
  // sign-in. Clearing the whole (tiny) API cache is the safe, simple choice — it
  // also covers NextAuth's login/logout, which POST to /api/auth/*.
  if (request.method !== 'GET') {
    if (sameOrigin && url.pathname.startsWith('/api/')) {
      event.waitUntil(caches.delete(API_CACHE));
    }
    return;
  }

  if (!sameOrigin) return; // let cross-origin pass through

  // Immutable build assets + icons → cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Global, non-sensitive read APIs → stale-while-revalidate: paint instantly from
  // the last copy, then refresh the cache in the background for next time.
  if (API_SWR_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            // Store only a good, same-origin response. A 401/403/redirect means the
            // session is gone or forbidden → drop any stale copy rather than serve it.
            if (res && res.status === 200 && res.type === 'basic') {
              cache.put(request, res.clone());
            } else {
              cache.delete(request);
            }
            return res;
          })
          .catch(() => undefined);

        if (cached) {
          event.waitUntil(network); // keep the background refresh alive
          return cached;
        }
        // Nothing cached yet → use the network (re-throw when offline so apiFetch
        // can surface the error).
        return (await network) || fetch(request);
      }),
    );
    return;
  }

  // Every other /api/ request (auth/session, members, polls, play, …) → never
  // cache; straight to the network.
  if (url.pathname.startsWith('/api/')) return;

  // Page navigations (per-user, role-specific HTML) → network-first with an offline
  // fallback. Deliberately never cache-served, so a session change can't surface a
  // stale or another user's page.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
  }
});

/* ── Web Push ──────────────────────────────────────────────────────────────
 * The server sends a JSON payload ({ title, body, url, tag }); we render it as
 * a native OS notification branded with the app icon. Tapping it focuses an
 * already-open window (if any) or opens a new one at the payload's URL.
 * NOTE: `badge` (the monochrome status-bar glyph) is intentionally omitted for
 * now — drop a /icons/badge-72.png in and add `badge: '/icons/badge-72.png'`
 * below once the real icon set exists; until then Android falls back to `icon`.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'GNW Hub', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'GNW Hub';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        // Focus an existing tab/PWA window if one is already on the app.
        if ('focus' in win) {
          win.focus();
          if ('navigate' in win && win.url !== target) win.navigate(target).catch(() => {});
          return;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
