/**
 * A post-login destination taken from the query string (`callbackUrl`), which
 * anyone can craft. Only a path on this site is followed: anything that resolves
 * to another origin (`https://evil.example`, `//evil.example`, `/\evil.example`)
 * or isn't http(s) (`javascript:…`) falls back to `/`, which routes by role.
 */
export function safeCallbackPath(raw: string | null, origin: string): string {
  if (!raw) return '/';
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return '/';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '/';
    if (url.pathname.startsWith('/login')) return '/'; // don't bounce back to the login page
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
