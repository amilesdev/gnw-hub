/* GNW Worship Hub — service worker.
 * Conservative by design: this app is auth-gated with dynamic data, so we never
 * cache API/auth responses. We cache-first only immutable hashed build assets and
 * icons, and serve an offline fallback page when a navigation can't reach the network.
 */
const VERSION = 'gnw-v2';
const STATIC_CACHE = `${VERSION}-static`;
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

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
  if (request.method !== 'GET') return; // never touch mutations
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin pass through
  if (url.pathname.startsWith('/api/')) return; // never cache API/auth

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

  // Page navigations → network-first, fall back to offline page when truly offline.
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
    data = { title: 'GNW Worship Hub', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'GNW Worship Hub';
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
