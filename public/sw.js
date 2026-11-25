/* GNW Hub — service worker.
 * Auth-gated app, so it caches carefully:
 *  • immutable hashed build assets + icons → cache-first
 *  • a small allowlist of team-wide read APIs (events, setlists, announcements) →
 *    stale-while-revalidate, so revisiting a screen paints instantly then refreshes
 *    in the background; when the refresh differs from what was painted, the page is
 *    told to reload it (lib/data-changed) instead of showing the old copy until the
 *    next visit. Events and setlists are role-filtered (Crossover visibility), so
 *    only their member view is stored — see SW_SCOPE_HEADER below
 *  • page navigations (per-user HTML) and every other API → network-first / never
 *    cached, which keeps private and role-specific data off disk
 *  • the two Home pages (/home, /dashboard) → this device's last copy paints at
 *    once, then the page refreshes its data in place (components/shared/
 *    LaunchRefresh). See "Fast launch" below; every other page stays network-only
 * Safety: only 200 same-origin responses are stored; a 401/403/redirect evicts any
 * stale copy; and ANY write or auth call (login/logout, POST/PATCH/DELETE to /api)
 * wipes the read cache, so nothing survives a sign-out/sign-in on a shared device.
 */
// v7: cached Home pages for a fast launch. v6: role-filtered reads are only
// cached in their member view. v5: the 3a redesign.
const VERSION = 'gnw-v7';
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;

/* ── Fast launch ────────────────────────────────────────────────────────────
 * A cold open used to sit on an empty screen until the server answered. Now
 * the Home page this device last loaded is kept (one copy per URL, per device)
 * and served straight from cache; LaunchRefresh then pulls fresh data in place.
 * This HTML is the signed-in person's own Home, so the pages cache is wiped on
 * every sign-in/sign-out/password call and whenever /login is reached, and a
 * redirect or 401/403 for a Home page evicts it. Leaders' /dashboard is only
 * ever stored on that leader's own device.
 * The stored copy is re-fetched at most once an hour (a background fetch costs
 * a server render, and Vercel Hobby CPU is capped); the in-place refresh is
 * what keeps the screen current.
 */
const PAGE_CACHE = `${VERSION}-pages`; // the "-pages" suffix is read by LaunchRefresh
const HOME_PAGES = new Set(['/home', '/dashboard']);
const LAST_HOME_KEY = '/__gnw/last-home';
const LAUNCH_KEY = '/__gnw/launch'; // keep in sync with LaunchRefresh
const PAGE_RESTORE_MS = 60 * 60 * 1000;
// Bumped on every wipe, so a fetch that started before a sign-out can't store
// the old person's page after it.
let pageEpoch = 0;

function clearPages() {
  pageEpoch++;
  return caches.delete(PAGE_CACHE);
}

function isAuthWrite(pathname) {
  return (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/password/') ||
    pathname === '/api/profile/password'
  );
}

async function storePage(key, path, res, epoch) {
  if (epoch !== pageEpoch) return;
  const body = await res.blob();
  const headers = new Headers(res.headers);
  // The body is already decoded, and Vary (RSC headers) would stop a plain
  // match from ever hitting.
  ['content-encoding', 'content-length', 'vary', 'set-cookie'].forEach((h) => headers.delete(h));
  headers.set('X-GNW-Cached-At', String(Date.now()));
  if (epoch !== pageEpoch) return;
  const cache = await caches.open(PAGE_CACHE);
  await cache.put(key, new Response(body, { status: 200, statusText: 'OK', headers }));
  await cache.put(LAST_HOME_KEY, new Response(path));
}

// Network fetch of a Home page that keeps the stored copy in step with it.
function fetchHome(request, key, path) {
  const epoch = pageEpoch;
  return fetch(request).then(async (res) => {
    const html = (res.headers.get('content-type') || '').includes('text/html');
    if (res.status === 200 && res.type === 'basic' && !res.redirected && html) {
      await storePage(key, path, res.clone(), epoch).catch(() => {});
    } else if (res.type === 'opaqueredirect' || res.redirected || res.status === 401 || res.status === 403) {
      // Signed out, revoked or the wrong role: never paint this copy again.
      const cache = await caches.open(PAGE_CACHE);
      await cache.delete(key);
    }
    return res;
  });
}

// When Home was just painted from cache and loads again within this window,
// it's Next's full-reload fallback (a failed refresh, or a new deploy whose
// build no longer matches the cached page) — so go to the network first, or the
// same old copy would answer forever.
const RETRY_NETWORK_MS = 20000;
const staleServedAt = new Map();

async function serveHome(event, url) {
  const key = url.origin + url.pathname;
  const cache = await caches.open(PAGE_CACHE);
  const cached = await cache.match(key);
  const now = Date.now();
  const retry = now - (staleServedAt.get(key) || 0) < RETRY_NETWORK_MS;
  if (!cached || retry) {
    try {
      return await fetchHome(event.request, key, url.pathname);
    } catch (_) {
      if (!cached) return caches.match('/offline.html');
      // Offline: fall through and paint the copy (LaunchRefresh says "Offline").
    }
  }
  staleServedAt.set(key, now);
  const cachedAt = Number(cached.headers.get('X-GNW-Cached-At')) || 0;
  // Tell the page it came from cache (read once by LaunchRefresh). Awaited, so
  // the marker is there before the page can look for it.
  await cache.put(
    LAUNCH_KEY,
    new Response(JSON.stringify({ path: url.pathname, cachedAt, servedAt: now }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  if (!retry && now - cachedAt > PAGE_RESTORE_MS) {
    // A plain URL fetch (not the navigation request, which is already answered).
    event.waitUntil(fetchHome(url.href, key, url.pathname).catch(() => {}));
  }
  return cached;
}

// The app launches at "/": go straight to the cached Home when there is one
// (works offline too); otherwise the edge redirect in middleware.ts handles it.
async function serveRoot(request, url) {
  const cache = await caches.open(PAGE_CACHE);
  const last = await cache.match(LAST_HOME_KEY);
  const path = last ? await last.text() : '';
  if (HOME_PAGES.has(path) && (await cache.match(url.origin + path))) {
    return Response.redirect(url.origin + path, 302);
  }
  return fetch(request).catch(() => caches.match('/offline.html'));
}
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

// Only these exact GET paths are cache-served. Each returns team-wide data with no
// user-specific fields. Do NOT add user-specific or real-time endpoints here
// (e.g. /api/members, /api/polls/*).
const API_SWR_PATHS = new Set(['/api/events', '/api/setlists', '/api/announcements']);

// Role-filtered reads (events, setlists) mark themselves with this header
// (lib/sw-cache.ts). Only `shared` — the member view, safe for every viewer — is
// stored; a `private` (leader) response is passed through and never cached, so a
// cached copy can't show someone events they've since lost access to. A response
// without the header (announcements) is global and cached as before.
const SW_SCOPE_HEADER = 'X-GNW-Cache-Scope';
function cacheable(res) {
  return res.headers.get(SW_SCOPE_HEADER) !== 'private';
}

// Writes that touch ONLY this device's own push-subscription row, so they can't
// invalidate any cached read above. Exempt from the cache-clearing rule below:
// the app-open re-sync POSTs here roughly once a day per device, and wiping the
// read cache for it would cost a needless network round-trip on the next
// events/setlists paint.
const API_NON_INVALIDATING_PATHS = new Set(['/api/push/subscribe']);
// Chat writes (sends, read marks, the ~25 s "viewing" heartbeat) only touch chat
// tables, which nothing above caches — so they don't clear the read cache either,
// or an open chat would wipe it every few seconds.
const API_NON_INVALIDATING_PREFIX = '/api/chat/';

// Bumped by every invalidating write. A background refresh that was already in
// flight when a save landed may carry pre-save data, so it isn't stored.
let writeEpoch = 0;
// Last "newer copy" notice per URL, so a response that differs on every fetch
// can never set off a reload loop.
const lastNotice = new Map();
const NOTICE_GAP_MS = 10000;

async function noticeIfChanged(url, cached, fresh) {
  if (!fresh || fresh.status !== 200) return;
  const [before, after] = await Promise.all([cached.text(), fresh.text()]);
  if (before === after) return;
  const now = Date.now();
  if (now - (lastNotice.get(url) || 0) < NOTICE_GAP_MS) return;
  lastNotice.set(url, now);
  const wins = await self.clients.matchAll({ type: 'window' });
  for (const win of wins) win.postMessage({ type: 'gnw-api-updated', url });
}

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
    // Sign-in, sign-out and password changes also drop the cached Home pages.
    if (sameOrigin && isAuthWrite(url.pathname)) event.waitUntil(clearPages());
    if (
      sameOrigin &&
      url.pathname.startsWith('/api/') &&
      !API_NON_INVALIDATING_PATHS.has(url.pathname) &&
      !url.pathname.startsWith(API_NON_INVALIDATING_PREFIX)
    ) {
      writeEpoch++;
      event.waitUntil(caches.delete(API_CACHE));
    }
    return;
  }

  if (!sameOrigin) return; // let cross-origin pass through

  // Reaching /login (a full load, or the client-side redirect a revoked session
  // gets) means whoever's Home is cached is no longer signed in here.
  if (url.pathname === '/login') event.waitUntil(clearPages());

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
        const epoch = writeEpoch;
        const network = fetch(request)
          .then((res) => {
            // Store only a good, same-origin response. A 401/403/redirect means the
            // session is gone or forbidden → drop any stale copy rather than serve it.
            if (res && res.status === 200 && res.type === 'basic' && cacheable(res)) {
              if (epoch === writeEpoch) cache.put(request, res.clone());
            } else {
              cache.delete(request);
            }
            return res;
          })
          .catch(() => undefined);

        if (cached) {
          // Keep the background refresh alive, and tell the page if it's newer
          // than the copy it's about to paint.
          const painted = cached.clone();
          event.waitUntil(
            network.then((res) => res && noticeIfChanged(url.href, painted, res.clone())).catch(() => {}),
          );
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
  // The two Home pages and the "/" launch are the exception: see "Fast launch".
  if (request.mode === 'navigate') {
    if (!url.search && HOME_PAGES.has(url.pathname)) {
      event.respondWith(serveHome(event, url));
      return;
    }
    if (!url.search && url.pathname === '/') {
      event.respondWith(serveRoot(request, url));
      return;
    }
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

/* Endpoint rotation. The push service can retire a subscription at any time — a
 * PWA reinstall, a device restore, some iOS updates. Without this handler the
 * old endpoint just dies: we keep sending to a dead row and the user silently
 * stops receiving notifications, while the in-app toggle still reads "on" from
 * local browser state. So: get a fresh subscription and hand it to the server,
 * along with the old endpoint so the dead row goes now rather than on the next
 * 410.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(resubscribe(event));
});

async function resubscribe(event) {
  const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
  try {
    // Some browsers hand us the replacement outright. Otherwise subscribe again,
    // reusing the old subscription's server key where it's exposed and asking the
    // server for the public VAPID key where it isn't (Safari doesn't expose it).
    let sub = event.newSubscription;
    if (!sub) {
      const key =
        (event.oldSubscription &&
          event.oldSubscription.options &&
          event.oldSubscription.options.applicationServerKey) ||
        (await fetchVapidKey());
      if (!key) return;
      sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
    }

    const json = sub.toJSON();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: self.navigator && self.navigator.userAgent,
        oldEndpoint,
      }),
    });
  } catch (_) {
    // Best-effort. If this fails (expired session, offline) the browser still
    // holds a subscription the server doesn't know about — which the app-open
    // re-sync in lib/use-push-sync.ts repairs the next time the app is opened.
  }
}

async function fetchVapidKey() {
  try {
    const res = await fetch('/api/push/key');
    if (!res.ok) return null;
    const { key } = await res.json();
    return key ? urlBase64ToUint8Array(key) : null;
  } catch (_) {
    return null;
  }
}

// VAPID keys travel as URL-safe base64; subscribe() wants raw bytes.
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

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
