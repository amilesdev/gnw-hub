/**
 * Remembers which home this device last opened, so launching the app ("/") can
 * redirect at the edge (middleware.ts) without a server round trip. It only
 * chooses a URL; the /home and /dashboard layouts still gate access.
 */
export const HOME_HINT_COOKIE = 'gnw-home';

export type HomeHint = '/home' | '/dashboard';

export function isHomeHint(v: string | undefined): v is HomeHint {
  return v === '/home' || v === '/dashboard';
}
