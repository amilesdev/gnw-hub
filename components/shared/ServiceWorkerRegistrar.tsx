'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (production only — registering in dev fights
 * Turbopack's HMR and serves stale assets; in dev it removes any leftover
 * worker instead). Renders nothing.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      // A worker left over from a local `npm start` keeps serving cached
      // /_next/static chunks cache-first — and dev chunk names don't change
      // between edits, so the browser runs old code indefinitely. Clear it out.
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      return;
    }
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
